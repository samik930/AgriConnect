import User from "../models/User.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/generateToken.js";

export const register = async(req,res) => {
    try {
        const {name, email,phone, password, role, state} = req.body;
        const alreadyExists = await User.findOne({
            $or : [{email},{phone}],
        })

        if(alreadyExists) {
            return res.status(400).json({
                message : "Already Registered",
            })
        }

        const hashedpassword = await bcrypt.hash(password,10);

        const user = await User.create({
            name,
            email,
            phone,
            password : hashedpassword,
            role, 
            state,
        })

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            state : user.state,
            token: generateToken(user._id),
        })

    } catch(error) {
        res.status(500).json({
            message: error.message,
        });
    }
}

export const login = async(req,res) => {
    try {
        const {email,password} = req.body ;
        const user = await User.findOne({email});

        if(user && (await bcrypt.compare(password,user.password))) {
            return res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            })
        }
        return res.status(401).json({
            message : "Invalid credentials",
        })
    } catch(error) {
        res.status(500).json({
            message: error.message,
        });
    }
}