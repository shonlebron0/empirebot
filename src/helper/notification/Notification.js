const { Command } = require('../../constants');
const Base = require('../Base');
const models = require('../../models');
const { NOTIFICATION_LIST_CLEAR } = require('../../constants/Command');

class Notification extends Base {
  constructor (client) {
    super(client, 'id');
  }

  async list (forceNew = false) {
    if (!forceNew && this._notifications.length) {
      return this._notifications;
    }

    const response = await this.client.websocket.emit(
      Command.NOTIFICATION_LIST,
      {
        language: this.client.options.language.code
      }
    );

    return response.success ? this.cache.add(response.body.map((notification) => new models.Notification(this.client, notification))) : [];
  }

  async clear () {
    return await this.client.websocket.emit(NOTIFICATION_LIST_CLEAR);
  }
}

module.exports = Notification;
