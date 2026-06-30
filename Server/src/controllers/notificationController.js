import Scheme from "../models/Scheme.js";
import Technology from "../models/Technology.js";
import User from "../models/User.js";

export const Notifyfarmers = async(req,res) => {
    try {
        const farmer = await User.findById(req.user._id);
        if(!farmer) {
            return res.status(400).json({
                success : true,
                message : "Farmer not found",
            })
        }
        const schemes = await Scheme.find({
            state : farmer.state,
        })

        const technologies = await Technology.find({
            state : farmer.state,
        })

        return res.status(201).json({
            farmer : farmer.name,
            schemes,
            technologies,
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}



