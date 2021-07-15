const fs = require('fs');

const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Place = require('../models/place');
const User = require('../models/user');
const mongoose = require('mongoose');


const getPlaceById = async (req, res, next) => {
    //console.log('Get request on places');
    const placeId = req.params.pid;
    let place;

    try{
        place = await Place.findById(placeId);
    }catch(error){
        const err = new HttpError('Something went wrong', 500);
        return next(err);
    }

    if(!place){
        const err = new HttpError('Could not find place with provided id.', 404);
        return next(err);
    }

    res.json({place : place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
    const userId = req.params.uid;
    let places;
    try{
        places = await Place.find({creator: userId});
    }catch(error){
        return next(new HttpError('Could not find places with provided user id.', 500));
    }

    if(!places || places.length === 0){
        return next(new HttpError('Could not find places with provided user id.', 404));
    }

    res.json({places: places.map(p => p.toObject({ getters: true }))});
};

const createPlace = async (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        console.log(errors);
        return next(new HttpError('Could not enter the result, please check your data input.', 422));
    }


    const {title, description, address} = req.body;
    let coordinates;
    try{
     coordinates = await getCoordsForAddress(address);
    }
    catch(error){
        return next(error);
    }

    const createdPlace = new Place({
        title,
        description,
        address,
        location: coordinates,
        image: req.file.path,
        creator: req.userData.userId
    });

    let user;

    try{
        user = await User.findById(req.userData.userId);
    }catch(error){
        const err = new HttpError('Could not create place please try again later', 500);
        return next(err);
    }

    if(!user){
        return next(new HttpError('Could not find the user with provided id', 404));
    }


    try{
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await createdPlace.save({session: sess});
        user.places.push(createdPlace);
        await user.save({session: sess});
        await sess.commitTransaction();

    }catch(error){
        const err = new HttpError('Could not create place please try again later I don\'t why', 500);
        return next(err);
    }

    res.status(201).json({place : createdPlace});
};

const updatePlace = async (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        console.log(errors);
        return next(new HttpError('Could not enter the result, please check your data input.', 422));
    }

    const {title, description} = req.body;
    const placeId= req.params.pid;
    let place;

    try{
        place = await Place.findById(placeId);
    }catch(error){
        const err = new HttpError('Something went wrong', 500);
        return next(err);
    }

    if(place.creator.toString() !== req.userData.userId){
        const err = new HttpError('You are not allowed to edit this place.', 401);
        return next(err);
    }

    
    place.title = title;
    place.description = description;

    try{
        await place.save();
    }catch(err){
        const error = new HttpError('Could not update place please try again later', 500);
        return next(error);
    }

    res.status(200).json({place : place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
    const placeId = req.params.pid;
    let place;

    try{
        place = await Place.findById(placeId).populate('creator');
    }catch(error){
        const err = new HttpError('Something went wrong', 500);
        return next(err);
    }

    if(!place){
        const err = new HttpError('Place with the given id cannot be found.', 404);
        return next(err);
    }

    if(place.creator.id !== req.userData.userId){
        const err = new HttpError('You cannot delete this place furr hole.', 401);
        return next(err);
    }

    const imagePath = place.image;

    try{
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await place.remove({session: sess});
        place.creator.places.pull(place);
        await place.creator.save({session: sess});
        await sess.commitTransaction();
    }catch(error){
        const err = new HttpError('Something went wrong', 500);
        return next(err);
    }

    fs.unlink(imagePath, err => {
        console.log(err);
    });

    res.status(200).json({message : 'Deleted place!'});
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;