import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import techRoutes from "./routes/techRoutes.js";
import notificationRoutes from "./routes/notifcationRoutes.js";
import schemeRoutes from "./routes/schemeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import trainingRoutes from "./routes/trainingRoutes.js";
import marketPriceRoutes from "./routes/marketPriceRoutes.js";

const app = express();

app.use(express.json());
app.use(cors({
  origin: /^http:\/\/localhost:\d+$/,  // allow any localhost port
  credentials: true,
}));
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews",reviewRoutes);
app.use("/api/technology",techRoutes);
app.use("/api/notification",notificationRoutes);
app.use("/api/schemes", schemeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/market-prices", marketPriceRoutes);
app.get("/", (req, res) => {
  res.send("Farmer Marketplace API Running");
});

export default app;