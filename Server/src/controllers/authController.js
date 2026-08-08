import User from "../models/User.js";
import OTP from "../models/OTP.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/generateToken.js";
import sendEmail from "../utils/sendEmail.js";

// Generate a 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendRegistrationOTP = async (req, res) => {
    try {
        const { email, phone } = req.body;
        
        const alreadyExists = await User.findOne({
            $or: [{ email }, { phone }],
        });

        if (alreadyExists) {
            return res.status(400).json({ message: "User already registered" });
        }

        const otp = generateOTP();
        await OTP.findOneAndDelete({ email }); // Delete old OTP if exists
        await OTP.create({ email, otp });

        const emailText = `Your OTP for registration is: ${otp}. It is valid for 5 minutes.`;
        await sendEmail(email, "Registration OTP", emailText, `<p>${emailText}</p>`);

        res.status(200).json({ message: "OTP sent successfully to email" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
export const register = async(req,res) => {
    try {
        const {name, email, phone, password, role, state, district, address, pincode, location, otp} = req.body;
        
        if (!otp) {
            return res.status(400).json({ message: "OTP is required for registration" });
        }

        const otpRecord = await OTP.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const alreadyExists = await User.findOne({
            $or : [{email},{phone}],
        })

        if(alreadyExists) {
            return res.status(400).json({
                message : "Already Registered",
            })
        }

        const hashedpassword = await bcrypt.hash(password,10);


        // Build location object if coordinates are provided
        const locationData = location && location.coordinates
            ? {
                type: "Point",
                coordinates: location.coordinates, // [lng, lat]
              }
            : undefined;

        const user = await User.create({
            name,
            email,
            phone,
            password : hashedpassword,
            role, 
            state,
            district,
            address,
            pincode,
            ...(locationData && { location: locationData }),
        })

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            state: user.state,
            district: user.district,
            address: user.address,
            pincode: user.pincode,
            location: user.location,
            token: generateToken(res, user._id),
        })

        // Cleanup used OTP
        await OTP.findOneAndDelete({ email });

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
                phone: user.phone,
                role: user.role,
                state: user.state,
                district: user.district,
                address: user.address,
                pincode: user.pincode,
                location: user.location,
                token: generateToken(res, user._id),
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

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found with this email" });
        }

        const otp = generateOTP();
        await OTP.findOneAndDelete({ email });
        await OTP.create({ email, otp });

        const emailText = `Your OTP to reset your password is: ${otp}. It is valid for 5 minutes.`;
        await sendEmail(email, "Password Reset OTP", emailText, `<p>${emailText}</p>`);

        res.status(200).json({ message: "Password reset OTP sent successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const otpRecord = await OTP.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const hashedpassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedpassword;
        await user.save();

        await OTP.findOneAndDelete({ email });

        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const logout = (req, res) => {
    res.cookie("jwt", "", {
        httpOnly: true,
        expires: new Date(0),
    });
    res.status(200).json({ message: "Logged out successfully" });
};