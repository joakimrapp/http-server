module.exports = ( log ) => {
	const http = require( 'http' );
	const express = require( 'express' );
	const socketio = require( 'socket.io' );
	const expressApp = express();
	const httpServer = http.createServer( expressApp );
	const sockets = new Map();
	httpServer.on( 'connection', ( socket ) => {
		sockets.set( socket, Date.now() );
		if( log )
			log.trace( 'http-socket connected, total sockets', sockets.size );
		socket.on( 'close', () => {
			sockets.delete( socket );
			if( log )
				log.trace( 'http-socket disconnected, total sockets', sockets.size );
		} );
	} );
	const socketioApp = socketio( httpServer );
	let port = 80;
	if( log )
		expressApp.use( ( req, res, next ) => log
			.trace( 'request', req.originalUrl )
			.timer( res.on( 'finish', () => log.timer( res ).trace( 'response', req.originalUrl ) ) )
			.return( next() ) );
	const pub = {
		express: {
			app: expressApp,
			router: ( route ) => {
				const router = express.Router();
				return ( route ? expressApp.use( route, router ) : expressApp.use( route, router ), router );
			},
			static: ( ...args ) => express.static( ...args ),
		},
		socketio: {
			app: socketioApp
		},
		port: ( value ) => ( ( port = value ), pub ),
		listen: () => ( new Promise( ( resolve, reject ) => {
			if( log )
				log.trace( 'trying to listen on port', port );
			httpServer.listen( port, ( err ) => err ? reject( err ) : resolve() );
		} ) )
			.then( () => {
				if( log )
					log.info( 'listening on port', port );
				return port;
			} ),
		close: () => new Promise( ( resolve, reject ) => {
			if( log ) {
				log.trace( 'closing on port', port ).timer( httpServer );
				log.debug( 'destroying sockets', sockets.size );
			}
			for( let socket of sockets.keys() ) {
				socket.end();
				socket.destroy();
			}
			httpServer.close( port, ( err ) => {
				if( err )
					reject( err );
				else {
					if( log )
						log.timer( httpServer ).info( 'closed on port', port );
					resolve();
				}
			} );
		} )
	};
	return pub;
};
