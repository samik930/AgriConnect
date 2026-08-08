import Technology from "../models/Technology.js";

export const addTechnology = async(req,res) => {
    try {
        const technology = await Technology.create({
            ...req.body,
            publishedBy : req.user?._id
        })

        res.status(201).json({
            success : true,
            technology,
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const showAllTechs = async(req,res) => {
    try {
        const technologies = await Technology.find().sort({createdAt:-1})
        if(!technologies) {
            return res.status(400).json({
                success : false,
                message : "No technology added yet",
            })
        }
        
        res.status(201).json({
            success : true,
            technologies,
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const getTechById = async(req,res) => {
    try {
        const technology = await Technology.findById(req.params.id)
        if(!technology) {
            return res.status(400).json({
                success : false,
                message : "No technology found",
            })
        }

        res.status(201).json({
            success : true,
            technology,
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const updateTechnology = async(req,res) => {
    try {
        const technology = await Technology.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new : true,
                runValidators : true,
            }
        )

        if(!technology) {
            return res.status(400).json({
                success : false,
                message : "No technology found",
            })
        }

        res.status(201).json({
            success : true,
            technology,
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}

export const deleteTechnology = async(req,res) => {
    try {
        const technology = await Technology.findById(req.params.id);
        if(!technology) {
            return res.status(400).json({
                success : false,
                message : "No technology found",
            })
        }
        await technology.deleteOne();
        res.status(201).json({
            success : true,
            message : "Technology deleted",
        })
    } catch(error) {
        res.status(500).json({
            message : error.message,
        })
    }
}