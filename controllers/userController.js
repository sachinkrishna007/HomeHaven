const User = require('../models/userModel')
const bcrypt = require('bcrypt')
require('dotenv').config();
const otpHelper = require("../Helper/otphelper");
const Product = require("../models/productModel")
const path = require('path');
const Cart = require('../models/cart')
const mongoose = require('mongoose');
const Order = require("../models/orderModel")


const accountSid =process.env.TWILIO_SID;
const authToken =process.env.TWILIO_AUTH_TOKEN;
const verifySid =process.env.VERIFY_SID;
const client = require("twilio")(accountSid, authToken);

//bcrypt
const securePassword = async (password) => {
    try {

        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {
        console.log(error.message);
    }
}

//load the homepage
const loadhome = async (req, res) => {
    try {
        
        // const user =  await User.findById(req.session.user_id)
      
        res.render('home', {})
    } catch (error) {
        console.log(error.message);
    }
}

//load the loginpage
const loadlogin = async (req, res) => {
    try {
        res.render('login')
    } catch (error) {
        console.log(error.message);
    }
}

//load registration page
const loadRegister = async (req, res) => {
    try {
        res.render('registration')
    } catch (error) {
        console.log(error.message);
    }
}
//signup validation
const validation = async (req, res) => {
    const email = req.body.email;
    const mobileNumber = req.body.mobile
    const existingUser = await User.findOne({ email: email })
    if (!req.body.name || req.body.name.trim().length === 0) {
        return res.render("registration", { message: "Name is required" });
    }
    if (/\d/.test(req.body.name) || /\d/.test(req.body.name)) {
        return res.render("registration", { message: "Numbers not allowed in nam" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.render("registration", { message: "Email Not Valid" });
    }
    if (existingUser) {
        return res.render("registration", { message: "Email already exists" })
    }
    const mobileNumberRegex = /^\d{10}$/;
    if (!mobileNumberRegex.test(mobileNumber)) {
        return res.render("registration", { message: "Mobile Number should be 10 digit" });

    }
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(req.body.password)) {
        return res.render("registration", { message: "Password Should Contain atleast 8 characters,one number and a special character" });
    }


    client.verify.v2
        .services(verifySid)
        .verifications.create({ to: `+91${mobileNumber}`, channel: "sms", })
        .then((verification) => {
            console.log(verification.status)
            req.session.userData = req.body;
            res.render('verifyOtp')
        })
        .catch((error) => {
            console.log(error.message)
        })
    

}
//verify oto and add user in signup
const verifyOtp = async (req, res) => {
    const { otp } = req.body;
    try {
        const userData = req.session.userData;

        if (!userData) {
            res.render('verifyOtp', { message: 'Invalid Session' });
        } else {
            client.verify.v2
                .services(verifySid)
                .verificationChecks.create({ to: `+91${userData.mobile}`, code: otp })
                .then(async (verification_check) => { // Mark the callback function as async
                    console.log(verification_check.status);
                    const spassword = await securePassword(userData.password);
                    const user = new User({
                        name: userData.name,
                        email: userData.email,
                        mobile: userData.mobile,
                        password: spassword,
                        is_admin: 0
                    });
                    try {
                        const userDataSave = await user.save();
                        if (userDataSave) {
                            res.redirect('/');
                        } else {
                            res.render('registration', { message: "Registration Failed" });
                        }
                    } catch (error) {
                        console.log(error.message);
                        res.render('registration', { message: "Registration Failed" });
                    }
                }).catch((error) => {
                    console.log(error.message);
                });
        }
    } catch (error) {
        console.log(error.message);
    }
};






const verifyLogin = async (req, res) => {

    try {
        const email = req.body.email;
        const password = req.body.password;
        const userData = await User.findOne({ email: email })

        if (userData) {

            if (userData.is_blocked) {
                res.render('login', { message: "Your account is blocked. Please contact support." });
                return;
            }

            const passwordMatch = await bcrypt.compare(password, userData.password)
            if (passwordMatch) {
                req.session.user_id = userData._id;
                req.session.user = await User.findOne({ _id: req.session.user_id });
                console.log(req.session.user_id)
                console.log("sucessfully signed in")
                res.redirect('/')
            } else {
                res.render('login', { message: "password incorrect" })
            }

        } else {
            res.render('login', { message: "Email Incorrect " })
        }
    } catch (error) {
        console.log(error.message)
    }
}


// verify the mobile number in otp login
const verifynumber = async (req, res) => {
    try {
        const mobileNumber = req.body.mobile
        const userData = await User.findOne({ mobile: mobileNumber })
        if (userData) {
            const otp = otpHelper.generateOtp()
            const oyy = otpHelper.sendOtp(mobileNumber, otp)
            console.log(`Otp is ${otp}`)
            try {

                req.session.otp = otp;
                req.session.userData = req.body;
                req.session.mobile = mobileNumber

                res.render('loginotp')
            } catch (error) {
                console.log(error.message);
            }


        }
    } catch (error) {
        console.log(error.message);
    }
}

const verifyOtpLogin = async (req, res) => {
    const otp = req.body.otp

    try {

        const sessionOTP = req.session.otp;
        const userData = req.session.userData;

        if (!sessionOTP || !userData) {
            res.render('loginotp', { message: 'Invalid Session' });
        } else if (sessionOTP !== otp) {
            res.render('loginotp', { message: 'Invalid OTP' });
        } else {

            req.session.user_id = userData;
            console.log("sucess signed in using otp");
            res.redirect('/')
        }

    } catch (error) {
        console.log(error.message);

    }
}


const logout = async (req, res) => {
    try {

        req.session.destroy()
        res.redirect('/')
    }
    catch (error) {
        console.log(error.message);

    }
}


const listProduct = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const ITEMS_PER_PAGE = 6;
    const totalProducts = await Product.countDocuments({ is_Listed: true });
    const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);
    const searchQuery = req.query.search || '';

    let searchFilter = { is_Listed: true };

    // Add search query to the filter if it is not empty
    if (searchQuery) {
      searchFilter.$or = [
        { name: { $regex: new RegExp(searchQuery, 'i') } },
        // Add other fields for searching, if needed
      ];
    }

    const productData = await Product.find(searchFilter)
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE);

    res.render('products', {
      productData,
      totalPages,
      currentPage: page,
      searchQuery: req.query.search || '', // Pass the searchQuery to the template
    });
  } catch (error) {
    console.log(error.message);
  }
};

  

const productDetail = async (req, res) => {
    try {
        const ProductId = req.params.id;
        const product = await Product.findById(ProductId)

        if (!product) {
            return res.status(404).send('product not found')
        }

        res.render('detailproduct', { product })


    } catch (error) {
        console.log(error.message);

    }
}


const errorpage = async (req, res) => {
    try {
        res.render('error-page')
    } catch (error) {
        console.log(error);
    }
}
const errormessage = async (req, res) => {
    try {
        res.render('error-message')
    } catch (error) {
        console.log(error);
    }
}
const blockpage = async (req, res) => {
    try {
        res.render('block')
    } catch (error) {
        console.log(error);
    }
}

const loadProfile = async(req,res) =>{
    try{
        const user =  await User.findById(req.session.user_id).populate('address');
       
        res.render('user-profile',{user})
    }catch(error){
      
        console.log(error.message);
    }
}   

const loadCheckout = async (req, res) => {
    try {
      const user = await User.findById(req.session.user_id).populate('address');
      const cartItems = await Cart.aggregate([
        {
          $match: { user: new mongoose.Types.ObjectId(req.session.user_id) }
        },
        {
          $unwind: "$cartItems"
        },
        {
          $project: {
            item: { $toObjectId: ("$cartItems.productId") },
            quantity: "$cartItems.quantity",
            total: "$cartItems.total"
          }
        },
        {
          $lookup: {
            from: "products",
            localField: "item",
            foreignField: "_id",
            as: "carted"
          }
        },
        {
          $project: {
            item: 1,
            quantity: 1,
            total: 1,
            carted: { $arrayElemAt: ["$carted", 0] }
          }
        }
      ]);
  
      res.render('checkout', { user, cartItems });
    } catch (error) {
      console.log(error.message);
      res.redirect('/cart'); 
    }
  };

  const processCheckout = async (req, res) => {
    try {
      const { paymentMethod, selectAddress } = req.body; 
      const userId = req.session.user_id;
      const user = await User.findById(userId).populate('address');
      const cartItems = await Cart.findOne({ user: userId });
      if (cartItems.cartTotal==0 ) {
        return res.render('error-message',{message:"no items in cart"})
      }
      console.log(cartItems);
  
      const address = user.selectedAddress
      
      if (!address) {
        return res.render('error-message',{message:"Address not found"})
      }
      const orderItems = cartItems.cartItems;

      // Check if there is enough stock for each product in the order
      for (const item of orderItems) {
        const product = await Product.findById(item.productId);
  
        if (!product || product.stock < item.quantity) {
          
          return res.render('error-message',{message:"sorry product out of stock/not found"})
        }
  
        // Reduce the stock quantity of the product
        product.stock -= item.quantity;
        await product.save();
      }
  
      const order = new Order({
        user: userId,
        address: address,
        items: cartItems.cartItems,
        total: cartItems.cartTotal,
        paymentMethod: paymentMethod,
        status: 'Pending',
      });
      await order.save();
  
      // Clear cart after placement
      await Cart.findOneAndUpdate({ user: userId }, { cartItems: [], cartTotal: 0 });
  
      res.redirect('/confirmation/' + order._id);
     
    } catch (error) {
      console.log(error.message);
      res.redirect('/checkout');
    }
  };
  
  const confirmation = async (req,res)=>{
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).populate('items.productId');
        if (!order) {
            return res.status(404).json({ error: 'Order not found.' });
          }
          const userId = req.session.user_id;
    const user = await User.findById(userId);
    const selectedAddressId = user.selectedAddress;
    let selectedAddress;
    if (selectedAddressId) {
      selectedAddress = user.address.find((address) => address._id.equals(selectedAddressId));
    }
        res.render("confirmation",{ order: order, selectedAddress: selectedAddress })
    } catch (error) {
        console.log(error.message);
  }
}
const forgotPassword = async (req,res)=>{
    try {
        res.render('forgotPassword')
    } catch (error) {
        error.mesage
    }
}
const forgotPasswordOtp = async (req,res)=>{
    console.log("1");
    try {
       const mobile =  req.body.mobile
       const user = await User.findOne({mobile: mobile})
       console.log(user);
       if(!user){
        res.render('forgotPassword',{message:"Mobile number Not found"})
         
       }
       
       else{
        client.verify.v2
        .services(verifySid)
        .verifications.create({ to: `+91${mobile}`, channel: 'sms' })
        .then((verification) => {
          console.log(verification.status)
          res.render('passwordOtp', { mobile: mobile });
        })
        .catch(error => {
            console.error('Error sending message:', error)
            res.render('login', { otpError: true, msg: 'Error sending OTP' });
          })
       }
    } catch (error) {
        error.mesage
    }
}

const forgotpasswordVerify =async(req,res)=>{
    try {
      const otp = req.body.otp;
      const mobile = req.body.mobile;
  
      const user = await User.findOne({ mobile: mobile });
      if (!user) {
        return res.render('login', { msg: 'User not found. Please register or try again.' });
      }
  
      if (user.is_Blocked) {
        return res.render('login', { msg: 'You are Blocked' });
      }
      client.verify.v2
        .services(verifySid)
        .verificationChecks.create({ to: `+91${mobile}`, code: otp })
        .then((verification_check) => {
          console.log(verification_check.status);
          res.render('password-reset',{mobile:mobile})
        })
  
    } catch (error) {
      console.log(error.message);
    }
  }

  const resetPassword = async (req, res) => {
    try {
        const { password, confirmPassword, mobile } = req.body;
        if (password !== confirmPassword) {
            return res.render('password-reset', {
                mobile: mobile,
                message: "Passwords do not match",
            });
        }
        const hashedPassword = await securePassword(password);
        await User.findOneAndUpdate({ mobile: mobile }, { password: hashedPassword });
        return res.render('login', { message: "Password reset successful" });

    } catch (error) {
        console.log(error.message);
        
        return res.render('reset-error', { message: "Password reset failed" });
    }
};



module.exports = {
    loadhome,
    loadlogin,
    loadRegister,
    verifyOtp,
    validation,
    verifyLogin,
    verifynumber,
    verifyOtpLogin,
    logout,
    listProduct,
    productDetail,
    errorpage,
    loadProfile,
    blockpage,
    loadCheckout,
    processCheckout,
    confirmation,
    errormessage,
    forgotPassword,
    forgotPasswordOtp,
    forgotpasswordVerify,
    resetPassword,
  
}