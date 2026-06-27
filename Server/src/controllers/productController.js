import Product from "../models/Product.js"

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
        const prods = await Product.find().populate("farmer","name email")
        res.json(prods)
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const getProductById =  async(req,res) => {
    try {
        const prod = await Product.findById(req.params.id).populate("farmer","name email")
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