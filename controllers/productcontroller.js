
const User = require("../models/userModel")
const Admin = require("../models/adminModel")
const Product = require('../models/productModel')
const Category = require('../models/catagoryModel')
const Order = require('../models/orderModel')
const path = require('path')


const multer = require('multer')
const { CANCELLED } = require("dns")


// const upload = require('./multerConfig');



const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'views/admin/images'); // Specify the destination folder
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now(); // Get the current timestamp
        const ext = path.extname(file.originalname); // Get the file extension
        const filename = uniqueSuffix + ext; // Construct the filename with timestamp and extension
        cb(null, filename);
    },
});

// Set up the multer middleware with size limit (in bytes)
const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 5, // 5 MB (adjust the size limit as needed)
    },
});


const addProduct = async (req, res) => {
    
    try {
        upload.array('images', 4)(req, res, async (err) => {
            if (err) {
                console.error(err); 
                return res.redirect('/admin'); 
            }

            // const { name, description, price, category } = req.body;
            const imageNames = req.files.map((file) => path.basename(file.path));
            const category = await Category.findOne({_id:req.body.category})

            const newProduct = new Product({
                name:req.body.name,
                description:req.body.description,
                price:req.body.price,
                category:category.name,
                stock:req.body.stock,
                offerprice:req.body.offerprice,

                images: imageNames,
            });

            const ProductResult = await newProduct.save();
            
        
            
           
            res.redirect('/admin/loadProduct'); 

        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};



const loadProduct = async(req,res)=>{
    try {
        const categories = await Category.find({}, '_id name');
        res.render('product-add',{categories})
    } catch (error) {
        console.log(error);
        
    }
}
const loadProductPage = async(req,res)=>{
    try{
        res.render('product-list')

    }catch(error){
        console.log(error);
    }
}

const productView = async(req,res)=>{
    try {
        let search = ''
      if(req.query.search){
        search = req.query.search
      }
      const productData= await Product.find({
        $or: [

            {name:{$regex:'.*'+search+'.*',$options:'i'}},
        ]
    }).sort({id:-1});

        // const productData= await Product.find({})
        res.render('product-list',{productData})

    } catch (error) {
        
    }
}

const deleteProduct = async(req,res)=>{
    try{
        const id=req.query.id;
        await Product.deleteOne({_id:id})
        res.redirect('/admin/productView')
    }catch(error){
        console.log(error);
    }
}
// add error image and render
const editProduct = async(req,res)=>{
    try{
        const productId = req.params.id;
        const product = await Product.findById(productId);
        const categories = await Category.find();
        res.render('edit-product', { product, categories });
    }catch(error){
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}
// uncle bob cleancode structure
const updateEditProduct = async (req, res) => {
    try {
      
        upload.array('images')(req, res, async (err) => {
            if (err) {
                console.error(err);
                return res.redirect('/admin');
            }

            const productId = req.params.id;
            // const { name, description, price, category } = req.body;
            const imageNames = req.files.map((file) => path.basename(file.path));
            const category = await Category.findOne({_id:req.body.category})


            const updatedProduct = await Product.findByIdAndUpdate(
                productId,
                {
                    name:req.body.name,
                    description:req.body.description,
                    price:req.body.price,
                    category:category.name,
                    stock:req.body.stock,
                    offerprice:req.body.offerprice,
                    images: imageNames,

                },
                { new: true }
            );

            res.redirect('/admin/productView');
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
};

const ProductSearch = async(req,res)=>{
    try{
           const query=req.query.query
           const products=await Product.find({
            $or:[
                { name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } },
            ]
           }) 
           res.render('product-list', { productData: products });
    }catch(error){
        console.log(message.error);
    }
}

const ITEMS_PER_PAGE = 4; 

const orderStatus = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; 
    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);

    const orders = await Order.find()
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
      .populate('user');

    res.render('order-status', {
      order: orders,
      currentPage: page,
      totalPages: totalPages
    });
  } catch (error) {
    console.log(error.message);
    res.redirect('/admin'); 
  }
};


const updateStatus = async(req,res) => {
    try{
        const orderId = req.params.orderId;
        const {newStatus} = req.body;

        await Order.findByIdAndUpdate(orderId,{status:newStatus})

        res.redirect('/admin/orders')

    }catch(error){
        console.log(error.message);
    }
}

const cancelOrder = async (req, res) => {
    try {
      const orderId = req.params.orderId;
  
      const order = await Order.findById(orderId).populate('items.productId');
      for (const item of order.items) {
        const product = item.productId;
        const originalStock = product.stock;
  
        // Increase the stock quantity
        product.stock = originalStock + item.quantity;
        await product.save();
      }
      await Order.findByIdAndUpdate(orderId, { status: "CANCELLED" });
  
      res.json({ message: 'Order cancelled successfully' });
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ error: 'An error occurred while cancelling the order' });
    }
  };

  // list
 const listProduct = async(req,res)=>{
    try {
      const id = req.query.id
      console.log(id);
      await Product.findByIdAndUpdate({_id:id},{$set:{is_Listed:false}})
      res.redirect('/admin/productView')
    } catch (error) {
      console.log(error)
    }
  }
 
//unblock the user
  const unlistProduct = async(req,res)=>{
    try {
      const id = req.query.id
      await Product.findByIdAndUpdate({_id:id},{$set:{is_Listed:true}})
      res.redirect('/admin/productView')
    } catch (error) {
      console.log(error)
    }
  }
 
module.exports = {
    addProduct,
    loadProduct,
    loadProductPage,
    productView,
    deleteProduct,
    editProduct,
    updateEditProduct,
    ProductSearch,
    orderStatus,
    updateStatus,
    cancelOrder,
    listProduct,
    unlistProduct
};


