const {validationResult} = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');
const User = require('../models/user');


const getUsers = async (req, res, next) => {
    let users;
    try{
        users = await User.find({}, '-password');
    }catch(err){
        return next(new HttpError('Fetching failed', 500));
    }

    res.json({users: users.map(user => user.toObject({ getters: true }) )});
};

const signup = async (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        console.log(errors);
        return next(new HttpError('Could not enter the result, please check your data input.', 422));
    }

    const {name, email, password} = req.body;


    let existingUser;
    try{
    existingUser = await User.findOne({ email : email });
    }catch(err){
        return next(new HttpError('Signup failed Please try again later', 500));
    }

    if(existingUser){
        return next(new HttpError('Email already exist. Login instead', 422));
    }

    let hashedPassword;
    try{
        hashedPassword = await bcrypt.hash(password, 12);
    }catch(err){
        return next(new HttpError('Could not create user Please try again later', 500));
    }

    const createdUser = new User({
        name,
        email,
        image: req.file.path,
        password: hashedPassword,
        places: []
    });


    try{
        await createdUser.save();
    }catch(error){
        const err = new HttpError('SignUp failed please try again later', 500);
        return next(err);
    }

    let token;
    try{
        token = jwt.sign({userId: createdUser.id, email: createdUser.email}, 
                         process.env.JWT_TOKEN,
                         {expiresIn: '1h'} );
    }catch(error){
        const err = new HttpError('SignUp failed please try again later', 500);
        return next(err);
    }
    res.status(201).json({userId: createdUser.id, email: createdUser.email, token: token });
};

const login = async (req, res, next) => {
    const {email, password} = req.body;

    let existingUser;
    try{
    existingUser = await User.findOne({ email : email });
    }catch(err){
        return next(new HttpError('Logging in failed Please try again later', 500));
    }

    if(!existingUser){
        return next(new HttpError('Wrong credentials Please try again later', 401));
    }

    let isValidPassword = false;
    try{
        isValidPassword = await bcrypt.compare(password, existingUser.password);
    }catch(err){
        return next(new HttpError('Login failed Please try again later', 500));
    }

    if(!isValidPassword){
        return next(new HttpError('Wrong credentials Please try again later', 401));
    }

    let token;
    try{
        token = jwt.sign({userId: existingUser.id, email: existingUser.email}, 
                        process.env.JWT_TOKEN,
                         {expiresIn: '1h'} );
    }catch(error){
        const err = new HttpError('Logging in failed please try again later', 500);
        return next(err);
    }

    res.json({userId: existingUser.id, email: existingUser.email, token: token });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;