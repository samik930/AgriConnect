import { query } from "../db/index.js";
import { formatProduct } from "../utils/formatters.js";

const DELIVERY_RADIUS_KM = 50;

/**
 * Helper to fetch a complete formatted cart for a customer
 */
const fetchFormattedCart = async (customerId) => {
  const cartRes = await query("SELECT * FROM carts WHERE customer_id = $1", [customerId]);
  if (cartRes.rows.length === 0) {
    return {
      customer: customerId,
      items: [],
    };
  }

  const cart = cartRes.rows[0];

  const itemsRes = await query(
    `
    SELECT 
      ci.id AS item_id, ci.quantity, ci.created_at AS item_created_at,
      p.id AS product_id, p.farmer_id, p.name AS product_name, p.category AS product_category,
      p.description AS product_description, p.price AS product_price, p.stock AS product_stock,
      p.unit AS product_unit,
      u.name AS farmer_name, u.email AS farmer_email, u.district AS farmer_district, u.state AS farmer_state
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    LEFT JOIN users u ON p.farmer_id = u.id
    WHERE ci.cart_id = $1
    ORDER BY ci.created_at ASC
    `,
    [cart.id]
  );

  const formattedItems = itemsRes.rows.map((row) => ({
    _id: row.item_id,
    id: row.item_id,
    quantity: row.quantity,
    product: {
      _id: row.product_id,
      id: row.product_id,
      name: row.product_name,
      category: row.product_category,
      description: row.product_description,
      price: parseFloat(row.product_price),
      stock: row.product_stock,
      unit: row.product_unit,
      farmer: row.farmer_id
        ? {
            _id: row.farmer_id,
            id: row.farmer_id,
            name: row.farmer_name,
            email: row.farmer_email,
            district: row.farmer_district,
            state: row.farmer_state,
          }
        : null,
    },
  }));

  return {
    _id: cart.id,
    id: cart.id,
    customer: customerId,
    items: formattedItems,
    createdAt: cart.created_at,
    updatedAt: cart.updated_at,
  };
};

export const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const customerId = req.user._id || req.user.id;

    // Check product exists and fetch farmer info
    const prodRes = await query(
      `
      SELECT p.*, u.name AS farmer_name,
             ST_X(u.location::geometry) AS farmer_lng,
             ST_Y(u.location::geometry) AS farmer_lat
      FROM products p
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.id = $1
      `,
      [productId]
    );

    if (prodRes.rows.length === 0) {
      return res.status(404).json({
        message: "Product doesn't exist",
      });
    }

    const prod = prodRes.rows[0];

    // Distance-based restriction: only enforce if both customer and farmer have coordinates
    const customer = req.user;
    const customerHasLocation = customer.location?.coordinates?.length === 2;
    const farmerHasLocation = prod.farmer_lng != null && prod.farmer_lat != null;

    if (customerHasLocation && farmerHasLocation) {
      const [cLng, cLat] = customer.location.coordinates;
      const fLng = prod.farmer_lng;
      const fLat = prod.farmer_lat;

      const distRes = await query(
        `SELECT ROUND((ST_Distance(
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
         ) / 1000)::numeric, 1) AS distance_km`,
        [cLng, cLat, fLng, fLat]
      );

      const distanceKm = parseFloat(distRes.rows[0].distance_km);

      if (distanceKm > DELIVERY_RADIUS_KM) {
        return res.status(403).json({
          message: `Farmer "${prod.farmer_name}" is ${distanceKm.toFixed(1)} km away. Delivery is only available within ${DELIVERY_RADIUS_KM} km radius.`,
          distanceKm,
          maxRadiusKm: DELIVERY_RADIUS_KM,
        });
      }
    }

    // Ensure cart exists
    const cartRes = await query(
      `
      INSERT INTO carts (customer_id)
      VALUES ($1)
      ON CONFLICT (customer_id) DO UPDATE SET updated_at = NOW()
      RETURNING id
      `,
      [customerId]
    );

    const cartId = cartRes.rows[0].id;
    const qty = parseInt(quantity || 1, 10);

    // Upsert item in cart
    await query(
      `
      INSERT INTO cart_items (cart_id, product_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (cart_id, product_id)
      DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()
      `,
      [cartId, productId, qty]
    );

    const fullCart = await fetchFormattedCart(customerId);
    res.status(200).json(fullCart);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getCart = async (req, res) => {
  try {
    const customerId = req.user._id || req.user.id;
    const cart = await fetchFormattedCart(customerId);
    res.json(cart);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const customerId = req.user._id || req.user.id;

    const cartRes = await query("SELECT id FROM carts WHERE customer_id = $1", [customerId]);
    if (cartRes.rows.length === 0) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const cartId = cartRes.rows[0].id;

    if (productId === "undefined" || !productId) {
      // Remove orphaned/null products
      await query(
        `
        DELETE FROM cart_items
        WHERE cart_id = $1 AND (product_id IS NULL OR product_id NOT IN (SELECT id FROM products))
        `,
        [cartId]
      );
    } else {
      await query(
        "DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2",
        [cartId, productId]
      );
    }

    const updatedCart = await fetchFormattedCart(customerId);
    res.json(updatedCart);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
