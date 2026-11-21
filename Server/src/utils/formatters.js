/**
 * Helper utilities to format PostgreSQL rows to match the frontend expectations
 * (preserving _id, location format, timestamps, etc.)
 */

export const formatUser = (userRow) => {
  if (!userRow) return null;

  let location = undefined;
  if (userRow.location_lng != null && userRow.location_lat != null) {
    location = {
      type: "Point",
      coordinates: [parseFloat(userRow.location_lng), parseFloat(userRow.location_lat)],
    };
  } else if (userRow.location && userRow.location.coordinates) {
    location = userRow.location;
  }

  const user = {
    _id: userRow.id,
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    phone: userRow.phone,
    role: userRow.role,
    state: userRow.state,
    district: userRow.district,
    address: userRow.address,
    pincode: userRow.pincode,
    location,
    createdAt: userRow.created_at,
    updatedAt: userRow.updated_at,
  };

  if (userRow.password) {
    user.password = userRow.password;
  }

  return user;
};

/**
 * Format user for public views (nearby farmers, directory, MCP output) with PII masking
 */
export const formatPublicUser = (userRow) => {
  if (!userRow) return null;
  const user = formatUser(userRow);
  delete user.password;
  if (user.phone && typeof user.phone === "string") {
    const cleaned = user.phone.replace(/[^\d+]/g, "");
    user.phone = cleaned.length >= 7 ? cleaned.slice(0, 3) + "******" + cleaned.slice(-4) : "******";
  }
  return user;
};

export const formatProduct = (productRow) => {
  if (!productRow) return null;

  let farmer = productRow.farmer_id;
  if (productRow.farmer_name) {
    farmer = {
      _id: productRow.farmer_id,
      id: productRow.farmer_id,
      name: productRow.farmer_name,
      email: productRow.farmer_email,
      state: productRow.farmer_state,
      district: productRow.farmer_district,
      location:
        productRow.farmer_lng != null && productRow.farmer_lat != null
          ? {
              type: "Point",
              coordinates: [parseFloat(productRow.farmer_lng), parseFloat(productRow.farmer_lat)],
            }
          : undefined,
    };
  }

  return {
    _id: productRow.id,
    id: productRow.id,
    name: productRow.name,
    category: productRow.category,
    description: productRow.description,
    price: parseFloat(productRow.price),
    stock: parseInt(productRow.stock, 10),
    unit: productRow.unit || "kg",
    image: productRow.image_url || productRow.image || null,
    imageUrl: productRow.image_url || productRow.image || null,
    farmer,
    createdAt: productRow.created_at,
    updatedAt: productRow.updated_at,
    ...(productRow.distance_km != null && { distanceKm: parseFloat(productRow.distance_km) }),
  };
};

export const formatOrder = (orderRow, items = []) => {
  if (!orderRow) return null;

  return {
    _id: orderRow.id,
    id: orderRow.id,
    customer: orderRow.customer_id
      ? {
          _id: orderRow.customer_id,
          id: orderRow.customer_id,
          name: orderRow.customer_name,
          email: orderRow.customer_email,
        }
      : orderRow.customer_id,
    items: items.map((item) => ({
      _id: item.id,
      id: item.id,
      product: item.product_id
        ? {
            _id: item.product_id,
            id: item.product_id,
            name: item.product_name,
            category: item.product_category,
            price: parseFloat(item.price || item.product_price || 0),
            unit: item.product_unit,
          }
        : item.product_id,
      farmer: item.farmer_id
        ? {
            _id: item.farmer_id,
            id: item.farmer_id,
            name: item.farmer_name,
            email: item.farmer_email,
          }
        : item.farmer_id,
      quantity: parseInt(item.quantity, 10),
      price: parseFloat(item.price),
      subtotal: parseFloat(item.subtotal),
    })),
    totalAmount: parseFloat(orderRow.total_amount),
    deliveryAddress: orderRow.delivery_address,
    paymentStatus: orderRow.payment_status,
    orderStatus: orderRow.order_status,
    paymentId: orderRow.payment_id,
    razorpayOrderId: orderRow.razorpay_order_id,
    createdAt: orderRow.created_at,
    updatedAt: orderRow.updated_at,
  };
};

export const formatReview = (reviewRow) => {
  if (!reviewRow) return null;

  return {
    _id: reviewRow.id,
    id: reviewRow.id,
    product: reviewRow.product_id,
    customer: reviewRow.customer_id
      ? {
          _id: reviewRow.customer_id,
          id: reviewRow.customer_id,
          name: reviewRow.customer_name,
        }
      : reviewRow.customer_id,
    rating: parseInt(reviewRow.rating, 10),
    comment: reviewRow.comment,
    createdAt: reviewRow.created_at,
    updatedAt: reviewRow.updated_at,
  };
};

export const formatScheme = (schemeRow) => {
  if (!schemeRow) return null;

  return {
    _id: schemeRow.id,
    id: schemeRow.id,
    title: schemeRow.title,
    description: schemeRow.description,
    state: schemeRow.state,
    district: schemeRow.district,
    eligibility: schemeRow.eligibility,
    applicationLink: schemeRow.application_link,
    publishedBy: schemeRow.published_by,
    createdAt: schemeRow.created_at,
    updatedAt: schemeRow.updated_at,
  };
};

export const formatTechnology = (techRow) => {
  if (!techRow) return null;

  return {
    _id: techRow.id,
    id: techRow.id,
    title: techRow.title,
    description: techRow.description,
    state: techRow.state,
    district: techRow.district,
    resourceLink: techRow.resource_link,
    publishedBy: techRow.published_by,
    createdAt: techRow.created_at,
    updatedAt: techRow.updated_at,
  };
};

export const formatTraining = (trainingRow) => {
  if (!trainingRow) return null;

  return {
    _id: trainingRow.id,
    id: trainingRow.id,
    title: trainingRow.title,
    organizer: trainingRow.organizer,
    date: trainingRow.date,
    location: trainingRow.location,
    registrationLink: trainingRow.registration_link,
    createdAt: trainingRow.created_at,
    updatedAt: trainingRow.updated_at,
  };
};

export const formatMarketPrice = (priceRow) => {
  if (!priceRow) return null;

  return {
    _id: priceRow.id,
    id: priceRow.id,
    cropName: priceRow.crop_name,
    district: priceRow.district,
    marketPrice: parseFloat(priceRow.market_price),
    unit: priceRow.unit || "kg",
    updatedAt: priceRow.updated_at,
  };
};

