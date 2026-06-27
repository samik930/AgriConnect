import Review from "../models/Review.js";
import Product from "../models/Product.js";

export const createReview = async(req,res) => {
    try {
        const {product , rating , comment} = req.body;
        const existingProduct = await Review.findOne({
            customer : req.user._id,
            product
        })

        if(existingProduct) {
            return res.status(400).json({
                success : false,
                message : "Review already done",
            })
        }

        const productExists = await Product.findById(product);

        if(!productExists) {
            return res.status(404).json({
                message : "Product doesn't exists",
            })
        }

        const review = await Review.create({
            customer : req.user._id,
            product,
            rating,
            comment
        })

        res.status(201).json({
            success: true,
            review,
        });
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const getProductReviews = async(req,res) => {
    try {
        const reviews = await Review.find({product : req.params.productId}).populate("customer", "name").sort({createdAt : -1})
        res.status(201).json({
            count : reviews.length,
            reviews,
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const updateReview = async(req,res) => {
    try {
        const {rating,comment} = req.body;

        const review = await Review.findOne({
            customer : req.user._id,
            _id : req.params.id,
        })

        if(!review) {
            return res.status(500).json({
                message : "Review doesn't exists.",
            })
        } 

        review.rating = rating;
        review.comment = comment;

        res.status(201).json({
            message : "Review Updated",
            review
        })

    } catch { 
        res.status(500).json({
            message : error.message,
        })
    }
}


export const deleteReview = async(req,res) => {
    try {
        const review = await Review.findOne({
            customer : req.user._id,
            _id : req.params.id,
        })

        if(!review) {
            return res.status(400).json({
                message : "Review doesn't exists",
            })
        }

        await review.deleteOne();

        res.status(201).json({
            message : "Review Deleted",
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}