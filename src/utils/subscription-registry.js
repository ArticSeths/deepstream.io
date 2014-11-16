var C = require( '../constants/constants' );

/**
 * A generic mechanism to handle subscriptions from sockets to topics.
 * A bit like an event-hub, only that it registers socket wrapper rather
 * than functions
 *
 * @constructor
 *
 * @param {Object} options deepstream options
 */
var SubscriptionRegistry = function( options ) {
	this._subscriptions = {};
	this._options = options;
};

/**
 * Sends a message string to all subscribers
 *
 * @param   {String} name      the name/topic the subscriber was previously registered for
 * @param   {String} msgString the message as string
 * @param   {[SocketWrapper]} sender an optional socketWrapper that shouldn't receive the message
 *
 * @public
 * @returns {void}
 */
SubscriptionRegistry.prototype.sendToSubscribers = function( name, msgString, sender ) {
	if( this._subscriptions[ name ] === undefined ) {
		return;
	}

	for( var i = 0; i < this._subscriptions[ name ].length; i++ ) {
		if( this._subscriptions[ name ][ i ] !== sender ) {
			this._subscriptions[ name ][ i ].send( msgString );
		}
	}
};

/**
 * Adds a SocketWrapper as a subscriber to a topic
 *
 * @param   {String} name          
 * @param   {SocketWrapper} socketWrapper
 *
 * @public
 * @returns {void}
 */
SubscriptionRegistry.prototype.subscribe = function( name, socketWrapper ) {
	if( this._subscriptions[ name ] === undefined ) {
		this._subscriptions[ name ] = [];
	}

	if( this._subscriptions[ name ].indexOf( socketWrapper ) !== -1 ) {
		var msg = 'repeat supscription to "' + name + '" by ' + socketWrapper.user; 
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.MULTIPLE_SUBSCRIPTIONS, msg );
		socketWrapper.sendError( C.TOPIC.EVENT, C.EVENT.MULTIPLE_SUBSCRIPTIONS, name );
		return;
	}

	socketWrapper.socket.once( 'close', this.unsubscribeAll.bind( this, socketWrapper ) );
	this._subscriptions[ name ].push( socketWrapper );
	socketWrapper.sendMessage( C.TOPIC.EVENT, C.ACTIONS.ACK, [ C.ACTIONS.SUBSCRIBE, name ] );
};

/**
 * Removes a SocketWrapper from the list of subscriptions for a topic
 *
 * @param   {String} name          
 * @param   {SocketWrapper} socketWrapper
 *
 * @public
 * @returns {void}
 */
SubscriptionRegistry.prototype.unsubscribe = function( name, socketWrapper ) {
	var msg,
		index = this._subscriptions[ name ].indexOf( socketWrapper );

	if( index === -1 ) {
		msg = socketWrapper.user + ' is not subscribed to ' + name;
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.NOT_SUBSCRIBED, msg );
		socketWrapper.sendError( C.TOPIC.EVENT, C.EVENT.NOT_SUBSCRIBED, name );
		return;
	}

	this._subscriptions[ name ].splice( index, 1 );
	socketWrapper.sendMessage( C.TOPIC.EVENT, C.ACTIONS.ACK, [ C.ACTIONS.UNSUBSCRIBE, name ] );
};

/**
 * Removes the SocketWrapper from all subscriptions. This is also called
 * when the socket closes
 *         
 * @param   {SocketWrapper} socketWrapper
 *
 * @public
 * @returns {void}
 */
SubscriptionRegistry.prototype.unsubscribeAll = function( socketWrapper ) {
	var name,
		index;

	for( name in this._subscriptions ) {
		index = this._subscriptions[ name ].indexOf( socketWrapper );

		if( index !== -1 ) {
			this._subscriptions[ name ].splice( index, 1 );
		}
	}
};

module.exports = SubscriptionRegistry;