const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  images: {
    type: Array,
  },
  category: {
    type:String,
    ref: 'Category',
    required: true,
  },
  price:{
    type:Number,
    required:true
  },offerprice:{
    type:Number,
    required:true
  },
  stock:{
    type:Number,
    required:true
  },

  isListed:{
    type:Boolean,
    default:true
  },
  
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;