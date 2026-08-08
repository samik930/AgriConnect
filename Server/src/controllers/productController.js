import Product from "../models/Product.js"
import User from "../models/User.js"

const DELIVERY_RADIUS_KM = 50;

// Get products from farmers within delivery radius of given coordinates
// Query: GET /api/products/nearby?lat=22.5726&lng=88.3639
export const getNearbyProducts = async(req,res) => {
    try {
        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                message: "lat and lng query parameters are required",
            });
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        // Find farmers within delivery radius using MongoDB geospatial query
        const nearbyFarmers = await User.find({
            role: "farmer",
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [longitude, latitude],
                    },
                    $maxDistance: DELIVERY_RADIUS_KM * 1000, // convert km to meters
                },
            },
        }).select("_id name");

        const farmerIds = nearbyFarmers.map((f) => f._id);

        const products = await Product.find({
            farmer: { $in: farmerIds },
        }).populate("farmer", "name email state district location");

        res.json({
            totalNearbyFarmers: nearbyFarmers.length,
            totalProducts: products.length,
            radiusKm: DELIVERY_RADIUS_KM,
            products,
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
}
export const createProduct = async(req,res) => {
    try {
        const prod = await Product.create({
            ...req.body,
            farmer : req.user._id
        })

        res.status(201).json(prod)
    } catch (error) {
        res.status(500).json({
            message : error.message
        })
    }
} 

export const getAllProducts = async(req,res) => {
    try {
        const prods = await Product.find().populate("farmer","name email district")
        if(!prods) {
            return res.state(400).json({
                message : "No products found",
            })
        }
        res.json(prods)
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const getProductById =  async(req,res) => {
    try {
        const prod = await Product.findById(req.params.id).populate("farmer","name email district")
        if(!prod) {
            return res.status(404).json({
                message : "Product not found",
            }) 
        } 
        res.json(prod)
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const updateProduct = async(req,res) => {
    try {
        const prod = await Product.findById(req.params.id)
        if(!prod) {
            return res.status(404).json({
                message : "Product not found",
            })
        } 
        if(prod.farmer.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                message: "Access denied"
            });
        }
        const updated = await Product.findByIdAndUpdate(req.params.id,req.body,{new:true})
        res.json(updated)
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const deleteProduct = async(req,res) => {
    try {
        const prod = await Product.findById(req.params.id)
        if(!prod) {
            return res.status(404).json({
                message : "Product not found",
            })
        } 
        if(prod.farmer.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        await Product.deleteOne(prod)

        res.json({
            message : "Product Deleted",
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}