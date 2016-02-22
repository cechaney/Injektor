
var config = require('./config.json');
var log4js = require('log4js');
var http = require('http');
var url = require('url');
var linestream = require('linestream');
var static = require('node-static');

(function(config){

	var that = this;

	try{
		log4js.configure('./log4js.json', {});
	} catch(error){
		console.log('Error configuring logging:' + error.message);
		return;
	}

	var logger = log4js.getLogger(config.appname);

	var handleRequest = function(req, res){

		try{

			proxyRequest(req, res)


  		} catch(error){

  			logger.error('Request error: ' + error.message);

  			res.statusCode = 500;
  			res.end;

  			return;
  		}

	};

	var proxyRequest = function(req, res){

		try{

			var reqUrl = url.parse(req.url, true, false);
			var reqMethod = req.method;
			var reqPath = reqUrl.path;
			var reqPathname = reqUrl.pathname;

			logger.debug('Proxying request: url=' + config.targetHost + reqPath);

			var options = {
				protocol: 'http:',
				method: reqMethod,
				hostname: config.targetHost,
				port: config.targetPort,
				path: reqPath,
				pathname: reqPathname
			}

	  		var proxy = http.request(options, function (resp) {

	  			try{

	  				var options = this;
	  				var fileExt = /\.[0-9a-z]+$/i;
					//var fileExt = new RegExp(config.ignoreRegex, config.ignoreRegexFlag);

	  				if(
	  					resp.headers['content-type'].toLowerCase() === 'text/html;charset=UTF-8'.toLowerCase()
	  					&&
	  					fileExt.test(options.pathname) === false){

						var stream = linestream.create(resp);

						stream.on('data', function(line){

							//Inject pills here

							/*
							if(line.indexOf(config.contentPillTrigger) > -1){

								config.contentPill.forEach (function (item) {
									res.write(item.replace('%STATIC_SERVER%', config.host + ":" + config.staticPort));
								});

								res.write(line);

							} else {
								res.write(line);
							}
							*/

							res.write(line);

						});

						stream.on('end', function(){
							logger.debug('Finished processing response for: ' + options.pathname);
							res.statusCode = 200;
							res.end();
						});

						stream.on('error', function(error) {
							logger.error('Error processing response stream: ' + error.message);
							res.statusCode = 500;
							res.end();
						});

	  				} else {

						resp.on('end', function(){
							logger.debug('Finished processing response for: ' + options.pathname);
							res.statusCode = 200;
							res.end();
						});

			    		resp.pipe(res, {
			      			end: false
			    		});
	  				}

	  			} catch(error){
	  				logger.error('Error on worker request: ' + error.message);
	  			}

	  		}.bind(options));

	  		proxy.setTimeout(config.proxyLoadTimeout, function(){

	  			try{

		  			logger.error('proxy target timeout');

		  			res.statusCode = 504;

	  			} catch(error){
	  				logger.error('Error on handle of worker timeout: ' + error.message);
	  			}

	  		});

	  		proxy.on('error', function(error){

	  			try{

		  			logger.error('Proxy error: ' + error.message);

		  			res.statusCode = 500;


	  			} catch(error){
	  				logger.error('Error on proxy error handler: ' + error.message);
	  			}

	  		});

			req.on('close', function(){

				try{

					proxy.abort();

				} catch(error){
					logger.error('Error on request close:' + error.message);
				}

			});

			if(proxy){

		  		req.pipe(proxy, {
		    		end: true
		  		});

			} else {
				res.statusCode = 429;
				res.end();
			}

  		} catch(error){

  			logger.error('Proxy request error: ' + error.message + '\r\n' + error.stack);

  			res.statusCode = 500;
  			res.end();

  			return;
  		}

	}

	var startProxyEndpoint = function(){

		try{

			http.createServer(function (req, res) {

				handleRequest(req, res);

			}).listen(config.port, config.host, function(){
				logger.info('Injektor server running at http://' + config.host + ':' + config.port + '/');
				logger.info('Proxying traffic for: ' + config.targetHost);
			});

		} catch(error){
			logger.error('Error on proxy endpoint start:' + error.message);
		}

	}

	var startStaticServer = function(){

		try{

			var file = new static.Server(config.staticDir);

			http.createServer(function (req, res) {

				req.addListener('end', function(){
					file.serve(req, res);
				}).resume();


			}).listen(config.staticPort, config.host, function(){
				logger.info('Static file server running at http://' + config.host + ':' + config.staticPort + '/');
			});

		} catch(error){
			logger.error('Error on static endpoint start:' + error.message);
		}

	}

	var boot = function(){

		try{

			startProxyEndpoint();
			startStaticServer();

		} catch(error){
			logger.error('Error on boot:' + error.message);
		}

	}

	boot();

})(config);