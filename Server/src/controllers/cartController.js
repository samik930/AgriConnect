import Cart from "../models/Cart.js"
import Product from "../models/Product.js"

export const addToCart = async(req,res) => {
    try {
        const {productId,quantity} = req.body;
        const prod = await Product.findById(productId);
        if(!prod) {
            return res.status(404).json({
                message : "Product doesn't exists",
            })
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
            item => item.product.toString() === productId
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
        const cart = await Cart.findOne({
            customer : req.user._id,
        })

        cart.items = cart.items.filter(
            item => item.product.toString() !== req.params.productId
        )

        await cart.save() 
        res.json(cart)
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

