import Scheme from "../models/Scheme.js";

export const CreateScheme = async(req,res) => {
    try {
        const scheme = await Scheme.create({
            ...req.body,
            createdBy : req.user?._id,
        })

        res.status(201).json({
            success: true,
            scheme,
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const getAllSchemes = async(req,res) => {
    try {
        const schemes = await Scheme.find().sort({
            createdAt : -1,
        })

        if(!schemes) {
            return res.status(400).json({
                success : false,
                message : "No schemes added yet",
            })
        }

        res.status(201).json({
            success: true,
            schemes,
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const getSchemeById = async(req,res) => {
    try {
        const scheme = await Scheme.findById(req.params.id)
        if(!scheme) {
            return res.status(400).json({
                message : "Scheme not found",
            })
        }
        res.status(201).json({
            success : true,
            scheme
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const updateScheme = async(req,res) => {
    try {
        const scheme = await Scheme.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        )

        if(!scheme) {
            return res.status(400).json({
                success : false,
                message : "Scheme Not found",
            })
        }

        res.status(201).json({
            success : true,
            message : "Scheme updated",
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const deleteScheme = async(req,res) => {
    try {
        const scheme = await Scheme.findById(
            req.params.id,
        )

        if(!scheme) {
            return res.status(400).json({
                success : false,
                message : "Scheme not found",
            })
        }

        await scheme.deleteOne()

        res.status(201).json({
            success : true,
            message : "Scheme deleted",
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}