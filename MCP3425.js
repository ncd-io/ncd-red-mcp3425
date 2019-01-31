"use strict";

const MCP3425 = require("./index.js");
const Queue = require("promise-queue");

module.exports = function(RED){
	var sensor_pool = {};
	var loaded = [];

	function NcdI2cDeviceNode(config){
		RED.nodes.createNode(this, config);

		//set the address from config
		this.addr = 0x68;

		//set the interval to poll from config
		this.interval = parseInt(config.interval);

		//remove sensor reference if it exists
		if(typeof sensor_pool[this.id] != 'undefined'){
			//Redeployment
			clearTimeout(sensor_pool[this.id].timeout);
			delete(sensor_pool[this.id]);
		}

		//create new sensor reference
		this.sensor = new MCP3425(this.addr, RED.nodes.getNode(config.connection).i2c, config);

		var node = this;

		sensor_pool[this.id] = {
			sensor: this.sensor,
			polling: false,
			timeout: 0,
			node: this
		};

		//Display device status on node
		function device_status(){
			if(!node.sensor.initialized){
				node.status({fill:"red",shape:"ring",text:"disconnected"});
				return false;
			}
			node.status({fill:"green",shape:"dot",text:"connected"});
			return true;
		}

		var incoming;

		//send telemetry data out the nodes output
		function send_payload(_status){
			var msg = incoming ? incoming : {};
			msg.payload = _status * config.mult;
			incoming = false;
			node.send(msg);
		}

		//get the current telemetry data
		function get_status(repeat, force){
			if(repeat) clearTimeout(sensor_pool[node.id].timeout);
			if(device_status(node)){
				node.sensor.get().then(send_payload).catch((err) => {
					node.send({error: err});
				}).then(() => {
					if(repeat && node.interval){
						clearTimeout(sensor_pool[node.id].timeout);
						sensor_pool[node.id].timeout = setTimeout(() => {
							if(typeof sensor_pool[node.id] != 'undefined') get_status(true);
						}, sensor_pool[node.id].node.interval);
					}else{
						sensor_pool[node.id].polling = false;
					}
				});
			}else{
				sensor_pool[node.id].timeout = setTimeout(() => {
					node.sensor.init();
					if(typeof sensor_pool[node.id] != 'undefined') get_status(true);
				}, 3000);
			}
		}
		get_status(node.interval && !sensor_pool[node.id].polling);

		//if status is requested, fetch it
		node.on('input', (msg) => {
			incoming = msg;
			get_status(false);
		});

		//if node is removed, kill the sensor object
		node.on('close', (removed, done) => {
			if(removed){
				clearTimeout(sensor_pool[node.id].timeout);
				delete(sensor_pool[node.id]);
			}
			done();
		});
	}

	//register the node with Node-RED
	RED.nodes.registerType("ncd-mcp3425", NcdI2cDeviceNode);
};
