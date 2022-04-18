const Base = require('./Base');

class Charm extends Base {
  constructor (api, data) {
    super(api);

    this._patch(data);
  }
}

module.exports = Charm;
