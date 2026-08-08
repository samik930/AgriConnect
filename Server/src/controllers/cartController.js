import Cart from "../models/Cart.js"
import Product from "../models/Product.js"
import User from "../models/User.js"
import { getDistance } from "geolib"

const DELIVERY_RADIUS_KM = 50;

export const addToCart = async(req,res) => {
    try {
        const {productId,quantity} = req.body;
        const prod = await Product.findById(productId);
        if(!prod) {
            return res.status(404).json({
                message : "Product doesn't exists",
            })
        }

        // Distance-based restriction: customer can only buy from farmers within delivery radius
        const customer = req.user;
        const farmer = await User.findById(prod.farmer).select("location district state name");

        if (
            !customer.location || !customer.location.coordinates || customer.location.coordinates.length < 2 ||
            !farmer || !farmer.location || !farmer.location.coordinates || farmer.location.coordinates.length < 2
        ) {
            return res.status(400).json({
                message: "Location information is missing. Both customer and farmer must have location coordinates set in their profile.",
            });
        }

        const distanceMeters = getDistance(
            { latitude: customer.location.coordinates[1], longitude: customer.location.coordinates[0] },
            { latitude: farmer.location.coordinates[1], longitude: farmer.location.coordinates[0] }
        );
        const distanceKm = distanceMeters / 1000;

        if (distanceKm > DELIVERY_RADIUS_KM) {
            return res.status(403).json({
                message: `Farmer "${farmer.name}" is ${distanceKm.toFixed(1)} km away. Delivery is only available within ${DELIVERY_RADIUS_KM} km radius.`,
                distanceKm: parseFloat(distanceKm.toFixed(1)),
                maxRadiusKm: DELIVERY_RADIUS_KM,
            });
        }

        let cart = await Cart.findOne({
            customer : req.user._id,
        })

        if(!cart) {
            cart = await Cart.create({
                customer : req.user._id,
                items : [],
            })
        }

        const ItemIdx = cart.items.findIndex(
            item => item.product && item.product.toString() === productId
        )

        if(ItemIdx > -1) {
            cart.items[ItemIdx].quantity += quantity;
        } else {
            cart.items.push({
                product : productId,
                quantity
            });
        }
        await cart.save()
        res.status(200).json(cart)
    } catch(error) {
        res.status(500).json({
            message: error.message
        });
    }
}

export const getCart = async(req,res) => {
    try {
        const cart = await Cart.findOne({
            customer : req.user._id,
        }).populate("items.product")

        res.json(cart);
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }   
}

export const removeFromCart = async(req,res) => {
    try {
        const { productId } = req.params;
        let updateQuery;

        if (productId === "undefined") {
            // If the product was deleted, its reference is null. Remove all orphaned items.
            updateQuery = { $pull: { items: { product: null } } };
        } else {
            updateQuery = { $pull: { items: { product: productId } } };
        }

        const cart = await Cart.findOneAndUpdate(
            { customer: req.user._id },
            updateQuery,
            { new: true }
        ).populate("items.product");

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        res.json(cart)
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

