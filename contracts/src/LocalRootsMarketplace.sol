// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAmbassadorRewards {
    function hasSufficientTreasury(uint256 amount) external view returns (bool);
    function queueReward(uint256 orderId, uint256 sellerId, uint256 saleAmount) external returns (uint256);
    function clawbackReward(uint256 orderId, string calldata reason) external;
    function recordCompletedOrder(uint256 sellerId, address buyer) external;
}

/**
 * @title LocalRootsMarketplace
 * @notice Decentralized marketplace for neighbors to buy/sell homegrown produce
 * @dev "Neighbors feeding neighbors"
 *      Rewards are only distributed after order completion (fraud protection)
 */
contract LocalRootsMarketplace is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public immutable rootsToken;
    address public ambassadorRewards;

    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5% to ambassador rewards
    uint256 public constant DISPUTE_WINDOW = 2 days;

    uint256 public nextSellerId;
    uint256 public nextListingId;
    uint256 public nextOrderId;

    // ============ Structs ============

    struct Seller {
        address owner;
        bytes8 geohash;           // Location encoded as geohash
        string storefrontIpfs;    // IPFS hash for storefront details
        bool offersDelivery;
        bool offersPickup;
        uint256 deliveryRadiusKm;
        uint256 createdAt;
        bool active;
    }

    struct Listing {
        uint256 sellerId;
        string metadataIpfs;      // IPFS hash for product details (name, description, images)
        uint256 pricePerUnit;     // Price in ROOTS (wei)
        uint256 quantityAvailable;
        bool active;
    }

    struct Order {
        uint256 listingId;
        uint256 sellerId;
        address buyer;
        uint256 quantity;
        uint256 totalPrice;
        bool isDelivery;
        OrderStatus status;
        uint256 createdAt;
        uint256 completedAt;
        bool rewardQueued;        // Whether ambassador reward was queued
        string proofIpfs;         // IPFS hash of delivery/pickup proof photo
        uint256 proofUploadedAt;  // When seller uploaded proof (starts dispute window)
        bool fundsReleased;       // Whether escrowed funds have been released to seller
    }

    enum OrderStatus {
        Pending,
        Accepted,
        ReadyForPickup,
        OutForDelivery,
        Completed,
        Disputed,
        Refunded,
        Cancelled
    }

    // ============ Mappings ============

    mapping(uint256 => Seller) public sellers;
    mapping(address => uint256) public sellerIdByOwner;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Order) public orders;

    // Geohash prefix to seller IDs for discovery at different precision levels
    // 4 chars = ~20km (City), 5 chars = ~2.4km (Neighborhood), 6 chars = ~610m (Few blocks)
    mapping(bytes4 => uint256[]) public sellersByGeohash4; // City level
    mapping(bytes5 => uint256[]) public sellersByGeohash5; // Neighborhood level (default)
    mapping(bytes6 => uint256[]) public sellersByGeohash6; // Few blocks level

    // ============ Events ============

    event SellerRegistered(uint256 indexed sellerId, address indexed owner, bytes8 geohash);
    event SellerUpdated(uint256 indexed sellerId);
    event ListingCreated(uint256 indexed listingId, uint256 indexed sellerId, uint256 pricePerUnit);
    event ListingUpdated(uint256 indexed listingId);
    event OrderCreated(uint256 indexed orderId, uint256 indexed listingId, address indexed buyer, uint256 quantity);
    event OrderStatusChanged(uint256 indexed orderId, OrderStatus status);
    event DisputeRaised(uint256 indexed orderId, address indexed buyer);
    event RewardQueued(uint256 indexed orderId, uint256 indexed sellerId);
    event FundsReleased(uint256 indexed orderId, address indexed seller, uint256 amount);
    event FundsRefunded(uint256 indexed orderId, address indexed buyer, uint256 amount);

    // ============ Constructor ============

    constructor(address _rootsToken, address _ambassadorRewards) {
        require(_rootsToken != address(0), "Invalid token address");
        rootsToken = IERC20(_rootsToken);
        ambassadorRewards = _ambassadorRewards;
    }

    // ============ Seller Functions ============

    /**
     * @notice Register as a seller
     * @param _geohash Location encoded as geohash (8 characters)
     * @param _storefrontIpfs IPFS hash for storefront details
     * @param _offersDelivery Whether seller offers delivery
     * @param _offersPickup Whether seller offers pickup
     * @param _deliveryRadiusKm Delivery radius in kilometers
     */
    function registerSeller(
        bytes8 _geohash,
        string calldata _storefrontIpfs,
        bool _offersDelivery,
        bool _offersPickup,
        uint256 _deliveryRadiusKm
    ) external returns (uint256 sellerId) {
        require(sellerIdByOwner[msg.sender] == 0, "Already registered as seller");
        require(_offersDelivery || _offersPickup, "Must offer delivery or pickup");

        sellerId = ++nextSellerId;

        sellers[sellerId] = Seller({
            owner: msg.sender,
            geohash: _geohash,
            storefrontIpfs: _storefrontIpfs,
            offersDelivery: _offersDelivery,
            offersPickup: _offersPickup,
            deliveryRadiusKm: _deliveryRadiusKm,
            createdAt: block.timestamp,
            active: true
        });

        sellerIdByOwner[msg.sender] = sellerId;

        // Index by geohash prefix at multiple precision levels for discovery
        bytes4 prefix4 = bytes4(_geohash);
        bytes5 prefix5 = bytes5(_geohash);
        bytes6 prefix6 = bytes6(_geohash);
        sellersByGeohash4[prefix4].push(sellerId); // City ~20km
        sellersByGeohash5[prefix5].push(sellerId); // Neighborhood ~2.4km
        sellersByGeohash6[prefix6].push(sellerId); // Few blocks ~610m

        emit SellerRegistered(sellerId, msg.sender, _geohash);
    }

    /**
     * @notice Update seller profile
     */
    function updateSeller(
        string calldata _storefrontIpfs,
        bool _offersDelivery,
        bool _offersPickup,
        uint256 _deliveryRadiusKm,
        bool _active
    ) external {
        uint256 sellerId = sellerIdByOwner[msg.sender];
        require(sellerId != 0, "Not a registered seller");
        require(_offersDelivery || _offersPickup, "Must offer delivery or pickup");

        Seller storage seller = sellers[sellerId];
        seller.storefrontIpfs = _storefrontIpfs;
        seller.offersDelivery = _offersDelivery;
        seller.offersPickup = _offersPickup;
        seller.deliveryRadiusKm = _deliveryRadiusKm;
        seller.active = _active;

        emit SellerUpdated(sellerId);
    }

    // ============ Listing Functions ============

    /**
     * @notice Create a new product listing
     * @param _metadataIpfs IPFS hash for product details
     * @param _pricePerUnit Price per unit in ROOTS
     * @param _quantityAvailable Quantity available
     */
    function createListing(
        string calldata _metadataIpfs,
        uint256 _pricePerUnit,
        uint256 _quantityAvailable
    ) external returns (uint256 listingId) {
        uint256 sellerId = sellerIdByOwner[msg.sender];
        require(sellerId != 0, "Not a registered seller");
        require(sellers[sellerId].active, "Seller not active");
        require(_pricePerUnit > 0, "Price must be > 0");
        require(_quantityAvailable > 0, "Quantity must be > 0");

        listingId = ++nextListingId;

        listings[listingId] = Listing({
            sellerId: sellerId,
            metadataIpfs: _metadataIpfs,
            pricePerUnit: _pricePerUnit,
            quantityAvailable: _quantityAvailable,
            active: true
        });

        emit ListingCreated(listingId, sellerId, _pricePerUnit);
    }

    /**
     * @notice Update a listing
     */
    function updateListing(
        uint256 _listingId,
        string calldata _metadataIpfs,
        uint256 _pricePerUnit,
        uint256 _quantityAvailable,
        bool _active
    ) external {
        Listing storage listing = listings[_listingId];
        require(listing.sellerId != 0, "Listing does not exist");
        require(sellers[listing.sellerId].owner == msg.sender, "Not listing owner");

        listing.metadataIpfs = _metadataIpfs;
        listing.pricePerUnit = _pricePerUnit;
        listing.quantityAvailable = _quantityAvailable;
        listing.active = _active;

        emit ListingUpdated(_listingId);
    }

    // ============ Buyer Functions ============

    /**
     * @notice Purchase items from a listing
     * @dev Payment is held in escrow until seller provides delivery proof.
     *      Ambassador rewards are queued at order completion.
     * @param _listingId Listing to purchase from
     * @param _quantity Quantity to purchase
     * @param _isDelivery Whether buyer wants delivery (vs pickup)
     */
    function purchase(
        uint256 _listingId,
        uint256 _quantity,
        bool _isDelivery
    ) external nonReentrant returns (uint256 orderId) {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(listing.quantityAvailable >= _quantity, "Insufficient quantity");

        Seller storage seller = sellers[listing.sellerId];
        require(seller.active, "Seller not active");

        if (_isDelivery) {
            require(seller.offersDelivery, "Seller does not offer delivery");
        } else {
            require(seller.offersPickup, "Seller does not offer pickup");
        }

        uint256 totalPrice = listing.pricePerUnit * _quantity;

        // Hold funds in escrow (this contract) until seller provides delivery proof
        rootsToken.safeTransferFrom(msg.sender, address(this), totalPrice);

        // Update listing quantity
        listing.quantityAvailable -= _quantity;

        // Create order
        orderId = ++nextOrderId;
        orders[orderId] = Order({
            listingId: _listingId,
            sellerId: listing.sellerId,
            buyer: msg.sender,
            quantity: _quantity,
            totalPrice: totalPrice,
            isDelivery: _isDelivery,
            status: OrderStatus.Pending,
            createdAt: block.timestamp,
            completedAt: 0,
            rewardQueued: false,
            proofIpfs: "",
            proofUploadedAt: 0,
            fundsReleased: false
        });

        emit OrderCreated(orderId, _listingId, msg.sender, _quantity);
    }

    // ============ Order Management ============

    /**
     * @notice Seller accepts an order
     */
    function acceptOrder(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Pending, "Invalid order status");
        require(sellers[order.sellerId].owner == msg.sender, "Not order seller");

        order.status = OrderStatus.Accepted;
        emit OrderStatusChanged(_orderId, OrderStatus.Accepted);
    }

    /**
     * @notice Mark order as ready for pickup with proof photo
     * @dev Starts 48-hour dispute window. Seller can claim funds after window expires.
     * @param _orderId Order ID
     * @param _proofIpfs IPFS hash of photo proof showing items ready for pickup
     */
    function markReadyForPickup(uint256 _orderId, string calldata _proofIpfs) external {
        require(bytes(_proofIpfs).length > 0, "Proof photo required");

        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Accepted, "Invalid order status");
        require(sellers[order.sellerId].owner == msg.sender, "Not order seller");
        require(!order.isDelivery, "Order is for delivery");

        order.proofIpfs = _proofIpfs;
        order.proofUploadedAt = block.timestamp;
        order.status = OrderStatus.ReadyForPickup;

        emit OrderStatusChanged(_orderId, OrderStatus.ReadyForPickup);
    }

    /**
     * @notice Mark order as out for delivery with proof photo
     * @dev Starts 48-hour dispute window. Seller can claim funds after window expires.
     * @param _orderId Order ID
     * @param _proofIpfs IPFS hash of photo proof showing delivery (e.g., items on porch)
     */
    function markOutForDelivery(uint256 _orderId, string calldata _proofIpfs) external {
        require(bytes(_proofIpfs).length > 0, "Proof photo required");

        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Accepted, "Invalid order status");
        require(sellers[order.sellerId].owner == msg.sender, "Not order seller");
        require(order.isDelivery, "Order is for pickup");

        order.proofIpfs = _proofIpfs;
        order.proofUploadedAt = block.timestamp;
        order.status = OrderStatus.OutForDelivery;

        emit OrderStatusChanged(_orderId, OrderStatus.OutForDelivery);
    }

    /**
     * @notice Complete an order (buyer confirms receipt)
     * @dev This triggers ambassador reward queueing with 7-day vesting
     *      Circuit breakers require seller activation (2 orders, 2 unique buyers)
     */
    function completeOrder(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];
        require(
            order.status == OrderStatus.ReadyForPickup ||
            order.status == OrderStatus.OutForDelivery,
            "Invalid order status"
        );
        require(order.buyer == msg.sender, "Not order buyer");

        order.status = OrderStatus.Completed;
        order.completedAt = block.timestamp;

        if (ambassadorRewards != address(0)) {
            // Record completed order for seller activation tracking
            // This must happen BEFORE queueReward to potentially activate the seller
            try IAmbassadorRewards(ambassadorRewards).recordCompletedOrder(
                order.sellerId,
                order.buyer
            ) {} catch {}

            // Queue ambassador reward (with 7-day vesting for fraud protection)
            // Will only succeed if seller is activated (2 orders, 2 unique buyers)
            if (!order.rewardQueued) {
                try IAmbassadorRewards(ambassadorRewards).queueReward(
                    _orderId,
                    order.sellerId,
                    order.totalPrice
                ) returns (uint256 pendingRewardId) {
                    if (pendingRewardId > 0) {
                        order.rewardQueued = true;
                        emit RewardQueued(_orderId, order.sellerId);
                    }
                } catch {
                    // If reward queueing fails, order still completes
                    // This prevents ambassador contract issues from blocking orders
                }
            }
        }

        emit OrderStatusChanged(_orderId, OrderStatus.Completed);
    }

    /**
     * @notice Raise a dispute (within dispute window)
     * @dev This triggers clawback of any pending ambassador rewards
     *      Can dispute from Pending/Accepted (funds in escrow) or after delivery proof
     */
    function raiseDispute(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        require(order.buyer == msg.sender, "Not order buyer");
        require(
            order.status == OrderStatus.Pending ||
            order.status == OrderStatus.Accepted ||
            order.status == OrderStatus.Completed ||
            order.status == OrderStatus.ReadyForPickup ||
            order.status == OrderStatus.OutForDelivery,
            "Cannot dispute this order"
        );

        if (order.status == OrderStatus.Completed) {
            require(
                block.timestamp <= order.completedAt + DISPUTE_WINDOW,
                "Dispute window expired"
            );
        }

        order.status = OrderStatus.Disputed;

        // Clawback any pending ambassador rewards
        if (ambassadorRewards != address(0) && order.rewardQueued) {
            try IAmbassadorRewards(ambassadorRewards).clawbackReward(
                _orderId,
                "Order disputed by buyer"
            ) {} catch {
                // If clawback fails, dispute still proceeds
            }
        }

        emit DisputeRaised(_orderId, msg.sender);
        emit OrderStatusChanged(_orderId, OrderStatus.Disputed);
    }

    // ============ Escrow Functions ============

    /**
     * @notice Seller claims escrowed funds after dispute window expires
     * @dev Can only be called 48 hours after proof upload, if not disputed
     * @param _orderId Order ID to claim funds for
     */
    function claimFunds(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];
        require(sellers[order.sellerId].owner == msg.sender, "Not order seller");
        require(!order.fundsReleased, "Funds already released");
        require(order.proofUploadedAt > 0, "No proof uploaded");
        require(
            order.status == OrderStatus.ReadyForPickup ||
            order.status == OrderStatus.OutForDelivery ||
            order.status == OrderStatus.Completed,
            "Invalid order status"
        );
        require(order.status != OrderStatus.Disputed, "Order is disputed");
        require(
            block.timestamp >= order.proofUploadedAt + DISPUTE_WINDOW,
            "Dispute window not expired"
        );

        _releaseFunds(_orderId);
    }

    /**
     * @notice Internal function to release escrowed funds to seller
     * @param _orderId Order ID to release funds for
     */
    function _releaseFunds(uint256 _orderId) internal {
        Order storage order = orders[_orderId];
        require(!order.fundsReleased, "Funds already released");

        Seller storage seller = sellers[order.sellerId];
        order.fundsReleased = true;

        rootsToken.safeTransfer(seller.owner, order.totalPrice);

        emit FundsReleased(_orderId, seller.owner, order.totalPrice);
    }

    /**
     * @notice Refund buyer for a disputed order (admin only for now)
     * @dev Can only refund orders where funds haven't been released yet
     * @param _orderId Order ID to refund
     */
    function refundBuyer(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Disputed, "Order not disputed");
        require(!order.fundsReleased, "Funds already released");

        // For now, only the seller can initiate a refund (voluntary)
        // In future, this could be admin-controlled or through arbitration
        require(sellers[order.sellerId].owner == msg.sender, "Not order seller");

        order.fundsReleased = true;
        order.status = OrderStatus.Refunded;

        rootsToken.safeTransfer(order.buyer, order.totalPrice);

        emit FundsRefunded(_orderId, order.buyer, order.totalPrice);
        emit OrderStatusChanged(_orderId, OrderStatus.Refunded);
    }

    // ============ View Functions ============

    /**
     * @notice Get sellers by geohash at city level (~20km radius)
     * @param _prefix First 4 characters of geohash
     */
    function getSellersByCity(bytes4 _prefix) external view returns (uint256[] memory) {
        return sellersByGeohash4[_prefix];
    }

    /**
     * @notice Get sellers by geohash at neighborhood level (~2.4km radius) - DEFAULT
     * @param _prefix First 5 characters of geohash
     */
    function getSellersByNeighborhood(bytes5 _prefix) external view returns (uint256[] memory) {
        return sellersByGeohash5[_prefix];
    }

    /**
     * @notice Get sellers by geohash at block level (~610m radius)
     * @param _prefix First 6 characters of geohash
     */
    function getSellersByBlock(bytes6 _prefix) external view returns (uint256[] memory) {
        return sellersByGeohash6[_prefix];
    }

    /**
     * @notice Check if an address is a registered seller
     */
    function isSeller(address _addr) external view returns (bool) {
        return sellerIdByOwner[_addr] != 0;
    }

    /**
     * @notice Get order details
     */
    function getOrder(uint256 _orderId) external view returns (Order memory) {
        return orders[_orderId];
    }
}
