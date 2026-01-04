// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./interfaces/ISwapRouter.sol";

interface IAmbassadorRewards {
    function hasSufficientTreasury(uint256 amount) external view returns (bool);
    function queueReward(uint256 orderId, uint256 sellerId, uint256 saleAmount) external returns (uint256);
    function queueSeedsReward(uint256 orderId, uint256 sellerId, uint256 saleAmount) external;
    function clawbackReward(uint256 orderId, string calldata reason) external;
    function recordCompletedOrder(uint256 sellerId, address buyer) external;
    function recordSellerRecruitment(uint256 sellerId, uint256 ambassadorId) external;
}

/**
 * @title LocalRootsMarketplace
 * @notice Decentralized marketplace for neighbors to buy/sell homegrown produce
 * @dev "Neighbors feeding neighbors"
 *      Rewards are only distributed after order completion (fraud protection)
 */
contract LocalRootsMarketplace is ReentrancyGuard, ERC2771Context {
    using SafeERC20 for IERC20;

    // ============ Phase Configuration ============

    enum LaunchPhase { Phase1_USDC, Phase2_ROOTS }
    LaunchPhase public currentPhase;
    bool public phaseTransitionLocked;

    // USDC address on Base Sepolia (and mainnet)
    address public constant USDC_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // ============ State Variables ============

    IERC20 public rootsToken;  // Can be address(0) for Phase 1
    address public ambassadorRewards;

    // Note: No platform fees charged. Ambassador rewards come from treasury fund.
    uint256 public constant DISPUTE_WINDOW = 2 days;

    uint256 public nextSellerId;
    uint256 public nextListingId;
    uint256 public nextOrderId;

    // Admin management
    address[] public admins;
    mapping(address => bool) public isAdmin;
    mapping(uint256 => bool) public sellerSuspended;

    // Multi-token payment support
    mapping(address => bool) public acceptedPaymentTokens;
    address[] public paymentTokenList;
    address public swapRouter;

    // Exchange rate: 100 ROOTS = 1 USD (stablecoins have 6 decimals, ROOTS has 18)
    uint256 public constant ROOTS_PER_USD = 100;
    uint256 public constant STABLECOIN_DECIMAL_CONVERSION = 1e12; // 10^(18-6)

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
        string buyerInfoIpfs;     // IPFS hash of buyer's delivery address or contact info
        address paymentToken;     // Token used for payment (USDC in Phase 1, ROOTS in Phase 2)
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

    // Seller milestone tracking
    mapping(uint256 => uint256) public sellerListingCount;  // sellerId => number of listings
    mapping(uint256 => uint256) public sellerOrderCount;    // sellerId => number of completed orders

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

    // Admin events
    event AdminAdded(address indexed admin, address indexed addedBy);
    event AdminRemoved(address indexed admin, address indexed removedBy);
    event SellerSuspended(uint256 indexed sellerId, address indexed admin, string reason);
    event SellerUnsuspended(uint256 indexed sellerId, address indexed admin);
    event OrderCancelledByAdmin(uint256 indexed orderId, address indexed admin, string reason);

    // Payment token events
    event PaymentTokenAdded(address indexed token);
    event PaymentTokenRemoved(address indexed token);
    event SwapRouterUpdated(address indexed router);
    event PaymentSwapped(address indexed paymentToken, uint256 stablecoinAmount, uint256 rootsAmount);

    // Phase and Seeds events
    event PhaseTransitioned(LaunchPhase newPhase);
    event SeedsEarned(address indexed user, uint256 amount, string reason, uint256 orderId);
    event SellerMilestoneSeeds(address indexed seller, uint256 indexed sellerId, uint256 amount, string milestone);

    // ============ Modifiers ============

    modifier onlyAdmin() {
        require(isAdmin[_msgSender()], "Not an admin");
        _;
    }

    // ============ Constructor ============

    constructor(
        address _rootsToken,
        address _ambassadorRewards,
        address _trustedForwarder,
        address _initialAdmin,
        LaunchPhase _initialPhase
    ) ERC2771Context(_trustedForwarder) {
        require(_initialAdmin != address(0), "Invalid admin address");

        // For Phase 1, rootsToken can be address(0)
        // For Phase 2, rootsToken is required
        if (_initialPhase == LaunchPhase.Phase2_ROOTS) {
            require(_rootsToken != address(0), "Phase 2 requires token address");
            rootsToken = IERC20(_rootsToken);
        } else if (_rootsToken != address(0)) {
            rootsToken = IERC20(_rootsToken);
        }

        ambassadorRewards = _ambassadorRewards;
        currentPhase = _initialPhase;

        // Set up initial admin
        admins.push(_initialAdmin);
        isAdmin[_initialAdmin] = true;
    }

    // ============ Seller Functions ============

    /**
     * @notice Register as a seller
     * @param _geohash Location encoded as geohash (8 characters)
     * @param _storefrontIpfs IPFS hash for storefront details
     * @param _offersDelivery Whether seller offers delivery
     * @param _offersPickup Whether seller offers pickup
     * @param _deliveryRadiusKm Delivery radius in kilometers
     * @param _ambassadorId Optional ambassador ID who referred this seller (0 = no referral)
     */
    function registerSeller(
        bytes8 _geohash,
        string calldata _storefrontIpfs,
        bool _offersDelivery,
        bool _offersPickup,
        uint256 _deliveryRadiusKm,
        uint256 _ambassadorId
    ) external returns (uint256 sellerId) {
        require(sellerIdByOwner[_msgSender()] == 0, "Already registered as seller");
        require(_offersDelivery || _offersPickup, "Must offer delivery or pickup");

        sellerId = ++nextSellerId;

        sellers[sellerId] = Seller({
            owner: _msgSender(),
            geohash: _geohash,
            storefrontIpfs: _storefrontIpfs,
            offersDelivery: _offersDelivery,
            offersPickup: _offersPickup,
            deliveryRadiusKm: _deliveryRadiusKm,
            createdAt: block.timestamp,
            active: true
        });

        sellerIdByOwner[_msgSender()] = sellerId;

        // Index by geohash prefix at multiple precision levels for discovery
        bytes4 prefix4 = bytes4(_geohash);
        bytes5 prefix5 = bytes5(_geohash);
        bytes6 prefix6 = bytes6(_geohash);
        sellersByGeohash4[prefix4].push(sellerId); // City ~20km
        sellersByGeohash5[prefix5].push(sellerId); // Neighborhood ~2.4km
        sellersByGeohash6[prefix6].push(sellerId); // Few blocks ~610m

        // Record ambassador referral if provided
        if (_ambassadorId > 0 && ambassadorRewards != address(0)) {
            IAmbassadorRewards(ambassadorRewards).recordSellerRecruitment(sellerId, _ambassadorId);
        }

        emit SellerRegistered(sellerId, _msgSender(), _geohash);
        // Note: No Seeds for profile completion - we reward action, not signup
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
        uint256 sellerId = sellerIdByOwner[_msgSender()];
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
        uint256 sellerId = sellerIdByOwner[_msgSender()];
        require(sellerId != 0, "Not a registered seller");
        require(sellers[sellerId].active, "Seller not active");
        require(_pricePerUnit > 0, "Price must be > 0");
        require(_quantityAvailable > 0, "Quantity must be > 0");

        // Track listing count for first_listing milestone
        bool isFirstListing = sellerListingCount[sellerId] == 0;
        sellerListingCount[sellerId]++;

        listingId = ++nextListingId;

        listings[listingId] = Listing({
            sellerId: sellerId,
            metadataIpfs: _metadataIpfs,
            pricePerUnit: _pricePerUnit,
            quantityAvailable: _quantityAvailable,
            active: true
        });

        emit ListingCreated(listingId, sellerId, _pricePerUnit);

        // Emit first_listing milestone Seeds in Phase 1 (minimal reward - prove you're serious)
        if (currentPhase == LaunchPhase.Phase1_USDC && isFirstListing) {
            emit SellerMilestoneSeeds(_msgSender(), sellerId, 50 * 1e6, "first_listing");
        }
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
        require(sellers[listing.sellerId].owner == _msgSender(), "Not listing owner");

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
     *      Phase 1: USDC only, emits Seeds events for indexing
     *      Phase 2: ROOTS or stablecoins (swapped to ROOTS)
     * @param _listingId Listing to purchase from
     * @param _quantity Quantity to purchase
     * @param _isDelivery Whether buyer wants delivery (vs pickup)
     * @param _buyerInfoIpfs IPFS hash of buyer's delivery address/contact info (required for delivery)
     * @param _paymentToken Payment token address (USDC in Phase 1, ROOTS/stablecoins in Phase 2)
     */
    function purchase(
        uint256 _listingId,
        uint256 _quantity,
        bool _isDelivery,
        string calldata _buyerInfoIpfs,
        address _paymentToken
    ) external nonReentrant returns (uint256 orderId) {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(listing.quantityAvailable >= _quantity, "Insufficient quantity");

        Seller storage seller = sellers[listing.sellerId];
        require(seller.active, "Seller not active");

        if (_isDelivery) {
            require(seller.offersDelivery, "Seller does not offer delivery");
            require(bytes(_buyerInfoIpfs).length > 0, "Delivery address required");
        } else {
            require(seller.offersPickup, "Seller does not offer pickup");
        }

        uint256 totalPriceRoots = listing.pricePerUnit * _quantity;
        uint256 orderAmount;
        address paymentTokenUsed;

        if (currentPhase == LaunchPhase.Phase1_USDC) {
            // Phase 1: USDC only
            require(_paymentToken == USDC_ADDRESS, "Phase 1: USDC only");

            // Calculate USDC amount (prices still in ROOTS units for compatibility)
            uint256 usdcAmount = _calculateStablecoinAmount(totalPriceRoots);

            // Hold USDC in escrow
            IERC20(USDC_ADDRESS).safeTransferFrom(_msgSender(), address(this), usdcAmount);

            orderAmount = usdcAmount;
            paymentTokenUsed = USDC_ADDRESS;

            // Emit Seeds for buyer (50 Seeds per $1 USDC spent)
            // USDC has 6 decimals, so usdcAmount / 1e6 = dollars
            // Seeds: 50 * usdcAmount (in USDC units, so 50 Seeds per 1 USDC = $1)
            emit SeedsEarned(_msgSender(), usdcAmount * 50, "purchase", nextOrderId + 1);
        } else {
            // Phase 2: ROOTS or stablecoins (swapped to ROOTS)
            if (_paymentToken == address(0) || _paymentToken == address(rootsToken)) {
                // Pay directly with ROOTS
                rootsToken.safeTransferFrom(_msgSender(), address(this), totalPriceRoots);
                paymentTokenUsed = address(rootsToken);
            } else {
                // Pay with stablecoin, swap to ROOTS
                require(acceptedPaymentTokens[_paymentToken], "Payment token not accepted");
                require(swapRouter != address(0), "Swap router not configured");

                uint256 stablecoinAmount = _calculateStablecoinAmount(totalPriceRoots);

                // Transfer stablecoin from buyer to this contract
                IERC20(_paymentToken).safeTransferFrom(_msgSender(), address(this), stablecoinAmount);

                // Approve swap router and swap to ROOTS
                IERC20(_paymentToken).approve(swapRouter, stablecoinAmount);
                uint256 rootsReceived = ISwapRouter(swapRouter).swapStablecoinForRoots(
                    _paymentToken,
                    stablecoinAmount,
                    totalPriceRoots
                );

                require(rootsReceived >= totalPriceRoots, "Insufficient ROOTS received from swap");
                emit PaymentSwapped(_paymentToken, stablecoinAmount, rootsReceived);
                paymentTokenUsed = _paymentToken;
            }
            orderAmount = totalPriceRoots;
        }

        // Update listing quantity
        listing.quantityAvailable -= _quantity;

        // Create order
        orderId = ++nextOrderId;
        orders[orderId] = Order({
            listingId: _listingId,
            sellerId: listing.sellerId,
            buyer: _msgSender(),
            quantity: _quantity,
            totalPrice: orderAmount,
            isDelivery: _isDelivery,
            status: OrderStatus.Pending,
            createdAt: block.timestamp,
            completedAt: 0,
            rewardQueued: false,
            proofIpfs: "",
            proofUploadedAt: 0,
            fundsReleased: false,
            buyerInfoIpfs: _buyerInfoIpfs,
            paymentToken: paymentTokenUsed
        });

        emit OrderCreated(orderId, _listingId, _msgSender(), _quantity);
    }

    /**
     * @notice Calculate stablecoin amount needed for a given ROOTS price
     * @param rootsAmount Amount in ROOTS (18 decimals)
     * @return stablecoinAmount Amount in stablecoin (6 decimals)
     */
    function _calculateStablecoinAmount(uint256 rootsAmount) internal pure returns (uint256) {
        // 100 ROOTS = 1 USD, ROOTS has 18 decimals, USDC/USDT have 6
        // rootsAmount / 100 / 1e12 = stablecoinAmount
        return rootsAmount / ROOTS_PER_USD / STABLECOIN_DECIMAL_CONVERSION;
    }

    /**
     * @notice Get the stablecoin price for a given ROOTS amount (view function for frontend)
     * @param rootsAmount Amount in ROOTS (18 decimals)
     * @return stablecoinAmount Amount in stablecoin (6 decimals)
     */
    function getStablecoinPrice(uint256 rootsAmount) external pure returns (uint256) {
        return rootsAmount / ROOTS_PER_USD / STABLECOIN_DECIMAL_CONVERSION;
    }

    // ============ Order Management ============

    /**
     * @notice Seller accepts an order
     */
    function acceptOrder(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Pending, "Invalid order status");
        require(sellers[order.sellerId].owner == _msgSender(), "Not order seller");

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
        require(sellers[order.sellerId].owner == _msgSender(), "Not order seller");
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
        require(sellers[order.sellerId].owner == _msgSender(), "Not order seller");
        require(order.isDelivery, "Order is for pickup");

        order.proofIpfs = _proofIpfs;
        order.proofUploadedAt = block.timestamp;
        order.status = OrderStatus.OutForDelivery;

        emit OrderStatusChanged(_orderId, OrderStatus.OutForDelivery);
    }

    /**
     * @notice Complete an order (buyer confirms receipt)
     * @dev Phase 1: Emits Seeds for seller and ambassadors
     *      Phase 2: Triggers ambassador reward queueing with 7-day vesting
     *      Circuit breakers require seller activation (2 orders, 2 unique buyers)
     */
    function completeOrder(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];
        require(
            order.status == OrderStatus.ReadyForPickup ||
            order.status == OrderStatus.OutForDelivery,
            "Invalid order status"
        );
        require(order.buyer == _msgSender(), "Not order buyer");

        order.status = OrderStatus.Completed;
        order.completedAt = block.timestamp;

        Seller storage seller = sellers[order.sellerId];

        // Track seller order count for milestones
        sellerOrderCount[order.sellerId]++;
        uint256 orderCount = sellerOrderCount[order.sellerId];

        if (currentPhase == LaunchPhase.Phase1_USDC) {
            // Phase 1: Emit Seeds for seller (500 Seeds per $1 USDC earned)
            // order.totalPrice is in USDC (6 decimals)
            emit SeedsEarned(seller.owner, order.totalPrice * 500, "sale", _orderId);

            // Emit seller milestone Seeds
            if (orderCount == 1) {
                emit SellerMilestoneSeeds(seller.owner, order.sellerId, 10000 * 1e6, "first_sale");
            } else if (orderCount == 5) {
                emit SellerMilestoneSeeds(seller.owner, order.sellerId, 25000 * 1e6, "five_sales");
            } else if (orderCount == 15) {
                emit SellerMilestoneSeeds(seller.owner, order.sellerId, 50000 * 1e6, "fifteen_sales");
            }

            // Queue Seeds reward for ambassadors (not ROOTS)
            if (ambassadorRewards != address(0)) {
                try IAmbassadorRewards(ambassadorRewards).recordCompletedOrder(
                    order.sellerId,
                    order.buyer
                ) {} catch {}

                try IAmbassadorRewards(ambassadorRewards).queueSeedsReward(
                    _orderId,
                    order.sellerId,
                    order.totalPrice
                ) {} catch {}
            }
        } else {
            // Phase 2: Existing ROOTS logic
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
        require(order.buyer == _msgSender(), "Not order buyer");
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

        emit DisputeRaised(_orderId, _msgSender());
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
        require(sellers[order.sellerId].owner == _msgSender(), "Not order seller");
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
     * @dev Handles both USDC (Phase 1) and ROOTS (Phase 2) based on order.paymentToken
     * @param _orderId Order ID to release funds for
     */
    function _releaseFunds(uint256 _orderId) internal {
        Order storage order = orders[_orderId];
        require(!order.fundsReleased, "Funds already released");

        Seller storage seller = sellers[order.sellerId];
        order.fundsReleased = true;

        // Release funds in the token that was used for payment
        if (order.paymentToken == USDC_ADDRESS) {
            IERC20(USDC_ADDRESS).safeTransfer(seller.owner, order.totalPrice);
        } else {
            rootsToken.safeTransfer(seller.owner, order.totalPrice);
        }

        emit FundsReleased(_orderId, seller.owner, order.totalPrice);
    }

    /**
     * @notice Refund buyer for a disputed order (admin only for now)
     * @dev Can only refund orders where funds haven't been released yet
     *      Handles both USDC (Phase 1) and ROOTS (Phase 2)
     * @param _orderId Order ID to refund
     */
    function refundBuyer(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Disputed, "Order not disputed");
        require(!order.fundsReleased, "Funds already released");

        // For now, only the seller can initiate a refund (voluntary)
        // In future, this could be admin-controlled or through arbitration
        require(sellers[order.sellerId].owner == _msgSender(), "Not order seller");

        order.fundsReleased = true;
        order.status = OrderStatus.Refunded;

        // Refund in the token that was used for payment
        if (order.paymentToken == USDC_ADDRESS) {
            IERC20(USDC_ADDRESS).safeTransfer(order.buyer, order.totalPrice);
        } else {
            rootsToken.safeTransfer(order.buyer, order.totalPrice);
        }

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

    // ============ Admin Functions ============

    /**
     * @notice Add a new admin
     * @param _newAdmin Address to grant admin rights
     */
    function addAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        require(!isAdmin[_newAdmin], "Already an admin");

        admins.push(_newAdmin);
        isAdmin[_newAdmin] = true;

        emit AdminAdded(_newAdmin, _msgSender());
    }

    /**
     * @notice Remove an admin
     * @param _admin Address to revoke admin rights
     */
    function removeAdmin(address _admin) external onlyAdmin {
        require(isAdmin[_admin], "Not an admin");
        require(admins.length > 1, "Cannot remove last admin");

        isAdmin[_admin] = false;

        // Remove from array
        for (uint256 i = 0; i < admins.length; i++) {
            if (admins[i] == _admin) {
                admins[i] = admins[admins.length - 1];
                admins.pop();
                break;
            }
        }

        emit AdminRemoved(_admin, _msgSender());
    }

    /**
     * @notice Get all admin addresses
     */
    function getAdmins() external view returns (address[] memory) {
        return admins;
    }

    /**
     * @notice Suspend a seller
     * @param _sellerId Seller ID to suspend
     * @param _reason Reason for suspension
     */
    function suspendSeller(uint256 _sellerId, string calldata _reason) external onlyAdmin {
        require(sellers[_sellerId].owner != address(0), "Seller does not exist");
        require(!sellerSuspended[_sellerId], "Already suspended");

        sellerSuspended[_sellerId] = true;
        sellers[_sellerId].active = false;

        emit SellerSuspended(_sellerId, _msgSender(), _reason);
    }

    /**
     * @notice Unsuspend a seller
     * @param _sellerId Seller ID to unsuspend
     */
    function unsuspendSeller(uint256 _sellerId) external onlyAdmin {
        require(sellers[_sellerId].owner != address(0), "Seller does not exist");
        require(sellerSuspended[_sellerId], "Not suspended");

        sellerSuspended[_sellerId] = false;
        sellers[_sellerId].active = true;

        emit SellerUnsuspended(_sellerId, _msgSender());
    }

    /**
     * @notice Check if a seller is suspended
     * @param _sellerId Seller ID to check
     */
    function isSellerSuspended(uint256 _sellerId) external view returns (bool) {
        return sellerSuspended[_sellerId];
    }

    /**
     * @notice Cancel a fraudulent order (admin only)
     * @dev Refunds buyer and claws back any pending ambassador rewards
     *      Handles both USDC (Phase 1) and ROOTS (Phase 2)
     * @param _orderId Order ID to cancel
     * @param _reason Reason for cancellation
     */
    function adminCancelOrder(uint256 _orderId, string calldata _reason) external onlyAdmin nonReentrant {
        Order storage order = orders[_orderId];
        require(order.buyer != address(0), "Order does not exist");
        require(!order.fundsReleased, "Funds already released");
        require(
            order.status != OrderStatus.Refunded &&
            order.status != OrderStatus.Cancelled,
            "Order already cancelled/refunded"
        );

        // Refund buyer in the token that was used for payment
        if (order.totalPrice > 0) {
            if (order.paymentToken == USDC_ADDRESS) {
                IERC20(USDC_ADDRESS).safeTransfer(order.buyer, order.totalPrice);
            } else {
                rootsToken.safeTransfer(order.buyer, order.totalPrice);
            }
        }

        order.fundsReleased = true;
        order.status = OrderStatus.Cancelled;

        // Clawback ambassador rewards if queued
        if (ambassadorRewards != address(0) && order.rewardQueued) {
            try IAmbassadorRewards(ambassadorRewards).clawbackReward(
                _orderId,
                _reason
            ) {} catch {}
        }

        emit OrderCancelledByAdmin(_orderId, _msgSender(), _reason);
        emit FundsRefunded(_orderId, order.buyer, order.totalPrice);
        emit OrderStatusChanged(_orderId, OrderStatus.Cancelled);
    }

    // ============ Payment Token Management (Admin) ============

    /**
     * @notice Add a payment token (USDC, USDT, etc.)
     * @param _token Token address to accept as payment
     */
    function addPaymentToken(address _token) external onlyAdmin {
        require(_token != address(0), "Invalid token address");
        require(!acceptedPaymentTokens[_token], "Token already accepted");

        acceptedPaymentTokens[_token] = true;
        paymentTokenList.push(_token);

        emit PaymentTokenAdded(_token);
    }

    /**
     * @notice Remove a payment token
     * @param _token Token address to stop accepting
     */
    function removePaymentToken(address _token) external onlyAdmin {
        require(acceptedPaymentTokens[_token], "Token not accepted");

        acceptedPaymentTokens[_token] = false;

        // Remove from array
        for (uint256 i = 0; i < paymentTokenList.length; i++) {
            if (paymentTokenList[i] == _token) {
                paymentTokenList[i] = paymentTokenList[paymentTokenList.length - 1];
                paymentTokenList.pop();
                break;
            }
        }

        emit PaymentTokenRemoved(_token);
    }

    /**
     * @notice Set the swap router for stablecoin → ROOTS conversions
     * @param _router Swap router contract address
     */
    function setSwapRouter(address _router) external onlyAdmin {
        require(_router != address(0), "Invalid router address");
        swapRouter = _router;
        emit SwapRouterUpdated(_router);
    }

    /**
     * @notice Get all accepted payment tokens
     * @return Array of accepted token addresses
     */
    function getAcceptedPaymentTokens() external view returns (address[] memory) {
        return paymentTokenList;
    }

    // ============ Phase Transition (Admin) ============

    /**
     * @notice Transition from Phase 1 (USDC) to Phase 2 (ROOTS)
     * @dev One-way transition, cannot be reversed
     * @param _rootsToken The ROOTS token address for Phase 2
     */
    function transitionToPhase2(address _rootsToken) external onlyAdmin {
        require(currentPhase == LaunchPhase.Phase1_USDC, "Already in Phase 2");
        require(!phaseTransitionLocked, "Transition already locked");
        require(_rootsToken != address(0), "Invalid token address");

        rootsToken = IERC20(_rootsToken);
        currentPhase = LaunchPhase.Phase2_ROOTS;
        phaseTransitionLocked = true;

        emit PhaseTransitioned(LaunchPhase.Phase2_ROOTS);
    }

    /**
     * @notice Set ambassador rewards contract (admin only)
     * @param _ambassadorRewards New ambassador rewards contract address
     */
    function setAmbassadorRewards(address _ambassadorRewards) external onlyAdmin {
        ambassadorRewards = _ambassadorRewards;
    }
}
