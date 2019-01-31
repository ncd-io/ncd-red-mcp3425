module.exports = class MCP3425{
	constructor(addr, comm, config){
		//ensure config is an object
		if(typeof config != 'object') config = {};

		//extend with default values
		this.config = Object.assign({
			resolution: 12,
			gain: 1,
			mode: 1
		}, config);

		//set default states and initialize
		this.comm = comm;
		this.addr = addr;
		this.initialized = false;
		this.status = {};
		this.raw = [];
		this.init();
	}
	configByte(){
		var gain = {"1": 0, "2": 1, "4": 2, "8": 3};
		return 128 | ((this.config.resolution - 12) / 2) * 4 | gain[this.config.gain] | (this.config.mode << 4);
	}
	init(){
		//Run initialization routine for the chip
		console.log("config byte", this.configByte());
		this.comm.writeBytes(this.addr, this.configByte()).then(() => {
			this.initialized = true;
		}).catch((err) => {
			this.initialized = false;
			console.log(err);
		});
	}
	get(read, tries=0){
		if(this.config.mode == 0 && read !== true){
			return new Promise((fulfill, reject) => {
				this.comm.writeBytes(this.addr, this.configByte()).then(() => {
					this.initialized = true;
					this.get(true).then(fulfill).catch(reject);
				}).catch((err) => {
					this.initialized = false;
					console.log(err);
				});
			});
		}else{
			//Fetch the telemetry values from the chip
			return new Promise((fulfill, reject) => {
				this.comm.readBytes(this.addr, 3).then((r) => {
					this.initialized = true;
					if((r[2] & 128) == 0){
						fulfill((r[0] << 8) | r[1]);
					}else{
						if(tries > 5){
							reject('Timeout, no new data');
						}else{
							this.get(true, tries++).then(fulfill).catch(reject);
						}
					}
				}).catch((err) => {
					this.initialized = false;
					reject(err);
				});
			});
		}
	}
};
