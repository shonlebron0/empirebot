import Base from './Base.js';

class Ad extends Base {
  constructor (client, data) {
    super(client);

    this.start = data.start;
    this.end = data.end;

    this.ad = data.ad;
  }

  toJSON () {
    return {
      start: this.start,
      end: this.end,
      ad: this.ad
    };
  }
}

export default Ad;