const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const otpGenerator = require("generate-otp");
require("dotenv").config();
const otpHelper = require("../Helper/otphelper");
const userHelper = require("../Helper/userHelper");
const Product = require("../models/productModel");
const Coupon = require("../models/couponModel");
const Banner = require("../models/bannerModel");
const OTP = require("../models/otpModel");
const path = require("path");
const Category = require("../models/catagoryModel");
const Cart = require("../models/cart");
const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Razorpay = require("razorpay");
// const { LoadWallet } = require('./profilecontoller');
const { RAZOR_PAY_ID_KEY, RAZOR_PAY_SECRET_KEY } = process.env;
const nodeMailer = require("nodemailer");
const { CLIENT_RENEG_LIMIT } = require("tls");
const razorPayInstance = new Razorpay({
  key_id: RAZOR_PAY_ID_KEY,
  key_secret: RAZOR_PAY_SECRET_KEY,
});

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.VERIFY_SID;
const client = require("twilio")(accountSid, authToken);

//bcrypt
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log(error.message);
  }
};

//load the homepage
const loadhome = async (req, res) => {
  try {
    const product = await Product.find().limit(6).sort({ _id: -1 });
    const banner = await Banner.find();
    const category = await Category.find();
    // const user =  await User.findById(req.session.user_id)
    const successMessage = req.session.successMessage;
    req.session.successMessage = null;
    res.render("home", { product, successMessage, banner, category });
  } catch (error) {
    console.log(error.message);
  }
};

//load the loginpage
const loadlogin = async (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    console.log(error.message);
  }
};

//load registration page
const loadRegister = async (req, res) => {
  try {
    res.render("registration");
  } catch (error) {
    console.log(error.message);
  }
};
//signup validation
const validation = async (req, res) => {
  const email = req.body.email;
  const mobileNumber = req.body.mobile;
  const existingUser = await User.findOne({ email: email });
  const existingMobile = await User.findOne({ mobile: mobileNumber });
  req.session.userData = req.body;
  if (existingUser) {
    return res.render("registration", { message: "Email already exists" });
  }
  if (existingMobile) {
    return res.render("registration", { message: "Mobile already exists" });
  }

  const otp = otpGenerator.generate(6, {
    digits: true,
    alphabets: false,
    upperCase: false,
    specialChars: false,
  });
  const transporter = nodeMailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: " Home - Haven OTP",
    text: `Your OTP for verification is: ${otp}`,
  };
  try {
    await OTP.create({ email, otp });
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    res.render("verifyOtp");
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
  // client.verify.v2
  //     .services(verifySid)
  //     .verifications.create({ to: `+91${mobileNumber}`, channel: "sms", })
  //     .then((verification) => {
  //         console.log(verification.status)
  //         req.session.userData = req.body;
  //         res.render('verifyOtp')
  //     })
  //     .catch((error) => {
  //         console.log(error.message)
  //     })
};
//verify oto and add user in signup
const verifyOtp = async (req, res) => {
  const { otp } = req.body;
  console.log(req.session.userData);
  try {
    const userData = req.session.userData;
    const otpDocument = await OTP.findOne({ email: userData.email, otp });
    if (!otpDocument) {
      res.render("verifyOtp", { message: "Invalid OTP" });
    }
    if (!userData) {
      res.render("verifyOtp", { message: "Invalid Session" });
    } else {
      console.log("sucesss");
      // client.verify.v2
      //     .services(verifySid)
      //     .verificationChecks.create({ to: `+91${userData.mobile}`, code: otp })
      //     .then(async (verification_check) => { // Mark the callback function as async
      //         console.log(verification_check.status);
      //         if(verification_check.status==='approved'){
      const spassword = await securePassword(userData.password);
      const user = new User({
        name: userData.name,
        lastName: userData.lname,
        email: userData.email,
        mobile: userData.mobile,
        password: spassword,
        is_admin: 0,
      });
      try {
        const userDataSave = await user.save();
        if (userDataSave) {
          res.redirect("/?registered=true");
        } else {
          res.render("registration", { message: "Registration Failed" });
        }
      } catch (error) {
        console.log(error.message);
        res.render("registration", { message: "Registration Failed" });
      }
      //
      //     }).catch((error) => {
      //         console.log(error.message);
      //     });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const verifyLogin = async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const userData = await User.findOne({ email: email });

    if (userData) {
      if (userData.is_blocked) {
        res.render("login", {
          message: "Your account is blocked. Please contact support.",
        });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, userData.password);
      if (passwordMatch) {
        req.session.user_id = userData._id;
        req.session.user = await User.findOne({ _id: req.session.user_id });
        console.log(req.session.user_id);
        // req.session.successMessage = "Successfully signed in!";
        res.cookie("successMessage", "true"); // Set the success message in a cookie
        // console.log("sucessfully signed in")
        res.redirect("/");
      } else {
        res.render("login", { message: "password incorrect" });
      }
    } else {
      res.render("login", { message: "Email Incorrect " });
    }
  } catch (error) {
    console.log(error.message);
  }
};

// verify the mobile number in otp login
const verifynumber = async (req, res) => {
  try {
    const mobileNumber = req.body.mobile;
    const userData = await User.findOne({ mobile: mobileNumber });
    if (userData) {
      const otp = otpHelper.generateOtp();
      const oyy = otpHelper.sendOtp(mobileNumber, otp);
      console.log(`Otp is ${otp}`);
      try {
        req.session.otp = otp;
        req.session.userData = req.body;
        req.session.mobile = mobileNumber;

        res.render("loginotp");
      } catch (error) {
        console.log(error.message);
      }
    }
  } catch (error) {
    console.log(error.message);
  }
};

const verifyOtpLogin = async (req, res) => {
  const otp = req.body.otp;

  try {
    const sessionOTP = req.session.otp;
    const userData = req.session.userData;

    if (!sessionOTP || !userData) {
      res.render("loginotp", { message: "Invalid Session" });
    } else if (sessionOTP !== otp) {
      res.render("loginotp", { message: "Invalid OTP" });
    } else {
      req.session.user_id = userData;
      console.log("sucess signed in using otp");
      res.redirect("/");
    }
  } catch (error) {
    console.log(error.message);
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy();

    res.redirect("/?success=true");
  } catch (error) {
    console.log(error.message);
  }
};

const listProduct = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const ITEMS_PER_PAGE = 9;
    const totalProducts = await Product.countDocuments({ is_Listed: true });
    const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);
    const searchQuery = req.query.search || "";

    const sortingOption = req.query.sort || "";
    const categoryId = req.query.category || "";

    const Cat = await Category.find({});
    const minPrice = parseFloat(req.query.minPrice); // Get the minimum price from request query parameters
    const maxPrice = parseFloat(req.query.maxPrice);

    let searchFilter = { is_Listed: true };

    // Add search query to the filter if it is not empty
    if (searchQuery) {
      searchFilter.$or = [
        { name: { $regex: new RegExp(searchQuery, "i") } },
        // Add other fields for searching, if needed
      ];
    }
    if (categoryId) {
      searchFilter.category = categoryId;
    }

    let sortCriteria = {};
    if (sortingOption == "price_asc") {
      sortCriteria.price = 1;
    } else if (sortingOption === "price_desc") {
      sortCriteria.price = -1;
    }

    const productData = await Product.find(searchFilter)
      .sort(sortCriteria)
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE);

    res.render("products", {
      productData,
      totalPages,
      currentPage: page,
      searchQuery: req.query.search || "", // Pass the searchQuery to the template
      selectedSort: sortingOption,
      Cat,
      categoryId,
    });
  } catch (error) {
    console.log(error.message);
  }
};

const productDetail = async (req, res) => {
  try {
    const ProductId = req.params.id;
    const product = await Product.findById(ProductId).populate("category");

    if (!product) {
      return res.status(404).send("product not found");
    }

    res.render("detailproduct", { product });
  } catch (error) {
    console.log(error.message);
  }
};

const errorpage = async (req, res) => {
  try {
    res.render("error-page");
  } catch (error) {
    console.log(error);
  }
};
const errormessage = async (req, res) => {
  try {
    res.render("error-message");
  } catch (error) {
    console.log(error);
  }
};
const blockpage = async (req, res) => {
  try {
    res.render("block");
  } catch (error) {
    console.log(error);
  }
};

const loadProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user_id).populate("address");

    res.render("user-profile", { user });
  } catch (error) {
    console.log(error.message);
  }
};

const loadCheckout = async (req, res) => {
  try {
    const user = await User.findById(req.session.user_id).populate("address");
    const coupon = await Coupon.find();
    const cartItems = await Cart.aggregate([
      {
        $match: { user: new mongoose.Types.ObjectId(req.session.user_id) },
      },
      {
        $unwind: "$cartItems",
      },
      {
        $project: {
          item: { $toObjectId: "$cartItems.productId" },
          quantity: "$cartItems.quantity",
          total: "$cartItems.total",
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "item",
          foreignField: "_id",
          as: "carted",
        },
      },
      {
        $project: {
          item: 1,
          quantity: 1,
          total: 1,
          carted: { $arrayElemAt: ["$carted", 0] },
        },
      },
    ]);

    res.render("checkout", { user, cartItems, coupon });
  } catch (error) {
    console.log(error.message);
    res.redirect("/cart");
  }
};

const processCheckout = async (req, res) => {
  try {
    const {
      paymentMethod,
      selectAddress,
      cartTotal,
      enteredCouponCode,
      TotalValue,
      subTotalvalue,
    } = req.body;
    console.log(req.body);
    const userId = req.session.user_id;
    const user = await User.findById(userId).populate("address");
    const cartItems = await Cart.findOne({ user: userId });

    if (cartItems.cartTotal == 0) {
      return res.render("error-message", { message: "no items in cart" });
    }
    // console.log(cartItems);

    const address = user.selectedAddress;

    if (!address) {
      console.log("addres not found");
      return res.status(400).json({ error: "Address not found" });
      return res.render("error-message", { message: "Address not found" });
    }
    const orderItems = cartItems.cartItems;

    // Check if there is enough stock for each product in the order
    for (const item of orderItems) {
      const product = await Product.findById(item.productId);

      if (!product || product.stock < item.quantity) {
        console.log("out of stock");
        return res
          .status(400)
          .json({ error: "sorry product out of stock/not found" });
        // return res.render('error-message',{message:"sorry product out of stock/not found"})
      }
      if (!paymentMethod) {
        return res.status(400).json({ error: "choose a Payment Method" });
      }

      // Reduce the stock quantity of the product
      product.stock -= item.quantity;
      await product.save();
    }

    if (paymentMethod === "wallet") {
      const paymentAmount = TotalValue || cartTotal;
      if (user.wallet < paymentAmount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      } else if (user.wallet >= paymentAmount) {
        user.wallet -= paymentAmount;
        user.walletTransaction.push({
          type: "debit",
          amount: paymentAmount,
          date: new Date(),
        });
        await user.save();
      }
    }

    const order = new Order({
      user: userId,
      address: address,
      items: cartItems.cartItems,
      total: cartTotal,
      paymentMethod: paymentMethod,
      status: "Pending",
      discountTotal: TotalValue,
      subTotal: subTotalvalue,
    });

    const orders = await order.save();
    console.log(orders + "orders");

    if (paymentMethod === "razorpay") {
      const newRazorpayOrder = async (cartItems, orders) => {
        const razorpayOrder = await razorPayInstance.orders.create({
          amount: cartTotal * 100,
          currency: "INR",
          receipt: orders._id.toString(),
        });
        return razorpayOrder;
      };

      const razorpayOrder = await newRazorpayOrder(cartItems, order);

      res.json({ orders, razorpayOrder });
    } else if (paymentMethod === "COD" || paymentMethod === "wallet") {
      res.json({ orders });
    }

    // Clear cart after placement
    await Cart.findOneAndUpdate(
      { user: userId },
      { cartItems: [], cartTotal: 0 }
    );
    //add coupon to user
    await addCouponToUser(enteredCouponCode, userId);
  } catch (error) {
    console.log(error.message);
    res.redirect("/checkout");
  }
};

const addCouponToUser = (couponCode, userId) => {
  try {
    return new Promise(async (resolve, reject) => {
      const updated = await User.updateOne(
        { _id: userId },
        {
          $push: {
            coupons: couponCode,
          },
        }
      ).then((couponAdded) => {
        resolve(couponAdded);
      });
    });
  } catch (error) {
    console.log(error.message);
  }
};
const verifyPayment = async (req, res) => {
  try {
    const data = req.body;

    const OrderId = data.data.receipt;
    // console.log(OrderId);
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", "2AvwPirbjue6XN0iQMf8L2eB");
    hmac.update(
      data.payment.razorpay_order_id + "|" + data.payment.razorpay_payment_id
    );
    const hashedHmac = hmac.digest("hex");

    if (hashedHmac === data.payment.razorpay_signature) {
      await Order.findByIdAndUpdate(OrderId, {
        onlinePaymentStatus: "success",
      });
      return res.json({ success: true, data });
    } else {
      return res.json({ success: false, error: "Payment verification failed" });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const confirmation = async (req, res) => {
  try {
    // const orderId = req.params.orderId;
    // const orderId = req.query.orderId;
    // const order = await Order.findById(orderId).populate('items.productId');
    // if (!order) {
    //     return res.status(404).json({ error: 'Order not found.' });
    //   }
    const userId = req.session.user_id;
    const user = await User.findById(userId);
    const selectedAddressId = user.selectedAddress;
    let selectedAddress;
    if (selectedAddressId) {
      selectedAddress = user.address.find((address) =>
        address._id.equals(selectedAddressId)
      );
    }

    res.render("confirmation", { selectedAddress: selectedAddress });
  } catch (error) {
    console.log(error.message);
  }
};
const forgotPassword = async (req, res) => {
  try {
    res.render("forgotpassword");
  } catch (error) {
    error.mesage;
  }
};
const forgotPasswordOtp = async (req, res) => {
  try {
    console.log(req.body);
    const mobile = req.body.mobile;
    const user = await User.findOne({ email: mobile });

    if (!user) {
      res.render("forgotpassword", { message: "email  Not found" });
    } else {
      console.log("here");
      const otp = otpGenerator.generate(6, {
        digits: true,
        alphabets: false,
        upperCase: false,
        specialChars: false,
      });
      const transporter = nodeMailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASSWORD,
        },
      });

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: mobile,
        subject: " Home - Haven OTP",
        text: `Your OTP for Reseting Password is: ${otp}`,
      };
      try {
        await OTP.create({ email:mobile, otp });
        const info = await transporter.sendMail(mailOptions);
        console.log("Message sent: %s", info.messageId);
        res.render("passwordOtp", { mobile: mobile });
      } catch (error) {
        console.error("Error sending email:", error);
        res.render("login", { otpError: true, msg: "Error sending OTP" });
      }
      // client.verify.v2
      //   .services(verifySid)
      //   .verifications.create({ to: `+91${mobile}`, channel: "sms" })
      //   .then((verification) => {
      //     console.log(verification.status);
      //     res.render("passwordOtp", { mobile: mobile });
      //   })
      //   .catch((error) => {
      //     console.error("Error sending message:", error);
      //     res.render("login", { otpError: true, msg: "Error sending OTP" });
      //   });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const forgotpasswordVerify = async (req, res) => {
  try {
    const otp = req.body.otp;
    const mobile = req.body.mobile;

    const user = await User.findOne({ email: mobile });
    if (!user) {
      return res.render("login", {
        msg: "User not found. Please register or try again.",
      });
    }

    if (user.is_Blocked) {
      return res.render("login", { msg: "You are Blocked" });
    }
    const otpDocument = await OTP.findOne({ email: mobile, otp });
    if (!otpDocument) {
      res.render("password-reset", { message: "Invalid OTP" });
    }
    res.render("password-reset", { mobile: mobile });
    // client.verify.v2
    //   .services(verifySid)
    //   .verificationChecks.create({ to: `+91${mobile}`, code: otp })
    //   .then((verification_check) => {
    //     console.log(verification_check.status);
    //     res.render("password-reset", { mobile: mobile });
    //   });
  } catch (error) {
    console.log(error.message);
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword, mobile } = req.body;
    if (password !== confirmPassword) {
      return res.render("password-reset", {
        mobile: mobile,
        message: "Passwords do not match",
      });
    }
    const hashedPassword = await securePassword(password);
    await User.findOneAndUpdate(
      { email: mobile },
      { password: hashedPassword }
    );
    return res.render("login", {
      message: "Password reset successfull please login Again",
    });
  } catch (error) {
    console.log(error.message);

    return res.render("reset-error", { message: "Password reset failed" });
  }
};

const contact = async (req, res) => {
  try {
    res.render("contact");
  } catch (error) {
    console.log(error.message);
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
  verifyPayment,
  contact,
};
