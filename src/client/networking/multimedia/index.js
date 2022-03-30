const AWS = require('aws-sdk');
const Signer = AWS.Signers.V4;
const Response = require('../../../models/ResponseObject');

const validator = require('../../../validator');

const imageSize = require('image-size');
const fileType = require('file-type');

const { v4: uuidv4 } = require('uuid');

const buildRoute = (route) => {
  return `/v${route.version}/${route.route}`;
};

/**
 * [MultiMediaService]: Error sending message to group message to: 2241764 with error CredentialsError: Could not load credentials from CognitoIdentityCredentials, retrying...
MissingRequiredParameter: Missing required key 'IdentityPoolId' in params
at ParamValidator.fail (C:\Users\WOLF Bots\Desktop\Bots\Bot-Tag\node_modules\aws-sdk\lib\param_validator.js:50:37)
at ParamValidator.validateStructure (C:\Users\WOLF Bots\Desktop\Bots\Bot-Tag\node_modules\aws-sdk\lib\param_validator.js:62:14)
at ParamValidator.validateMember (C:\Users\WOLF Bots\Desktop\Bots\Bot-Tag\node_modules\aws-sdk\lib\param_validator.js:89:21)
at ParamValidator.validate (C:\Users\WOLF Bots\Desktop\Bots\Bot-Tag\node_modules\aws-sdk\lib\param_validator.js:34:10)
at Request.VALIDATE_PARAMETERS (C:\Users\WOLF Bots\Desktop\Bots\Bot-Tag\node_modules\aws-sdk\lib\event_listeners.js:132:42)
at Request.callListeners (C:\Users\WOLF Bots\Desktop\Bots\Bot-Tag\node_modules\aws-sdk\lib\sequential_executor.js:106:20)
at Request.emit (C:\Users\WOLF Bots\Desktop\Bots\Bot-Tag\node_modules\aws-sdk\lib\sequential_executor.js:78:10)
at Request.emit (C:\Users\WOLF Bots\Desktop\Bots\Bot-Tag\node_modules\aws-sdk\lib\request.js:686:14)
at Request.transition (C:\Users\WOLF Bots\Desktop\Bots\Bot-Tag\node_modules\aws-sdk\lib\request.js:22:10)
at AcceptorStateMachine.runTo (C:\Users\WOLF Bots\Desktop\Bots\Bot-Tag\node_modules\aws-sdk\lib\state_machine.js:14:12)
internalErrorMessage: api.messaging().sendMessage(commandOrMessage=[object Object], content="Buffer -- Too long to display", opts={})
 */

/**
 * {@hideconstructor}
 */
module.exports = class MultiMediaServiceClient {
  constructor (api) {
    this._api = api;
    this._client = new AWS.HttpClient();

    this._api.on('loginSuccess', async () => this.setAWSCredentials());

    this._api.on('resume', async () => this.setAWSCredentials());
  }

  async setAWSCredentials () {
    if (!AWS.config.credentials) {
      AWS.config.credentials = new AWS.CognitoIdentityCredentials(
        {
          IdentityId: this._api.cognito.identity,
          Logins: {
            'cognito-identity.amazonaws.com': this._api.cognito.token
          }
        },
        {
          region: 'eu-west-1'
        }
      );
    } else {
      AWS.config.credentials.params.IdentityId = this._api.cognito.identity;
      AWS.config.credentials.params.Logins['cognito-identity.amazonaws.com'] = this._api.cognito.token;
    }
  };

  async _getCredentials () {
    if (AWS.config.credentials) {
      if (AWS.config.credentials.needsRefresh()) {
        await Promise.all([
          await this._api.getSecurityToken(true),
          this.setAWSCredentials()
        ]);

        return await new Promise((resolve, reject) => {
          AWS.config.credentials.refresh(function (error) {
            if (error) {
              reject(error);
            } else {
              resolve(AWS.config.credentials);
            }
          });
        });
      }
    }

    return await new Promise((resolve, reject) => {
      AWS.config.getCredentials(function (error) {
        if (error) {
          console.log('getError', error, AWS.config.credentials.params);
          reject(error);
        } else {
          resolve(AWS.config.credentials);
        }
      });
    });
  }

  async _sendRequest (route, body, attempt = 1) {
    try {
      const data = JSON.stringify({ body });

      const awsRequest = new AWS.HttpRequest(`${this._api.endpointConfig.mmsUploadEndpoint}${route}`, 'eu-west-1');
      awsRequest.method = 'POST';
      awsRequest.headers = {
        'Content-Length': data.length,
        'Content-Type': 'application/json',
        Host: awsRequest.endpoint.host
      };

      awsRequest.body = data;

      new Signer(awsRequest, 'execute-api').addAuthorization(await this._getCredentials(), new Date());

      return await new Promise((resolve, reject) => {
        this._client.handleRequest(awsRequest, null, function (response) {
          let responseBody = '';
          response.on('data', function (chunk) { responseBody += chunk; });

          response.on('end', function () {
            resolve(new Response(JSON.parse(responseBody), route));
          });
        }, function (error) {
          reject(error);
        });
      });
    } catch (error) {
      if (attempt >= 3) {
        throw error;
      }

      const mmsSettings = this._api._botConfig.multimedia;

      switch (route) {
        case buildRoute(mmsSettings.messaging):
          console.warn(`[MultiMediaService]: Error sending message to ${body.isGroup ? 'group' : 'private'} message to: ${body.recipient} with error ${error}, retrying...`);
          break;
        case buildRoute(mmsSettings.avatar.group):
          console.warn(`[MultiMediaService]: Error updating group ${body.id} avatar with error ${error}, retrying...`);
          break;
        case buildRoute(mmsSettings.avatar.subscriber):
          console.warn(`[MultiMediaService]: Error updating subscriber ${body.id} avatar with error ${error}, retrying...`);
          break;
        case buildRoute(mmsSettings.event):
          console.warn(`[MultiMediaService]: Error updating event ${body.id} thumbnail with error ${error}, retrying...`);
          break;
      }

      await this._getCredentials();

      return await this._sendRequest(route, body, attempt + 1);
    }
  }

  async sendMessage (targetType, targetId, content, mimeType) {
    if (validator.isNullOrWhitespace(targetType)) {
      throw new Error('targetType cannot be null or empty');
    } else if (!['group', 'private'].includes(targetType)) {
      throw new Error('targetType is not valid');
    }

    if (!validator.isValidNumber(targetId)) {
      throw new Error('targetId must be a valid number');
    } else if (validator.isLessThanOrEqualZero(targetId)) {
      throw new Error('targetId cannot be less than or equal to 0');
    }

    if (!Buffer.isBuffer(content)) {
      throw new Error('content must be a buffer');
    }

    const messagingSettings = this._api._botConfig.get('multimedia.messaging');

    if (!messagingSettings.validation.mimes.includes(mimeType)) {
      throw new Error('mimeType is unsupported');
    }

    const ext = (await fileType.fromBuffer(content)).ext;

    if (Buffer.byteLength(content) > messagingSettings.validation.size[ext]) {
      throw new Error(`maximum size allowed for mimeType ${mimeType} is ${messagingSettings.validation.size[ext]} bytes`);
    }

    const data = {
      data: mimeType === 'audio/x-m4a' ? content : content.toString('base64'),
      mimeType: mimeType === 'audio/x-m4a' ? 'audio/aac' : mimeType,
      recipient: targetId,
      isGroup: targetType === 'group',
      flightId: uuidv4()
    };

    return this._sendRequest(buildRoute(messagingSettings), data);
  }

  async uploadGroupAvatar (targetGroupId, avatar, mimeType) {
    if (!validator.isValidNumber(targetGroupId)) {
      throw new Error('targetGroupId must be a valid number');
    } else if (validator.isLessThanOrEqualZero(targetGroupId)) {
      throw new Error('targetGroupId cannot be less than or equal to 0');
    }

    if (!Buffer.isBuffer(avatar)) {
      throw new Error('avatar must be a buffer');
    }

    const groupAvatarSettings = this._api._botConfig.get('multimedia.avatar.group');

    if (!groupAvatarSettings.validation.mimes.includes(mimeType)) {
      throw new Error('mimeType is unsupported');
    }

    const size = imageSize(avatar);

    if (size.width !== size.height) {
      throw new Error('avatar must be square');
    }

    const ext = (await fileType.fromBuffer(avatar)).ext;

    if (Buffer.byteLength(avatar) > groupAvatarSettings.validation.size[ext]) {
      throw new Error(`maximum size allowed for mimeType ${mimeType} is ${groupAvatarSettings.validation.size[ext]} bytes`);
    }

    const body = {
      data: avatar.toString('base64'),
      mimeType,
      id: targetGroupId,
      source: this._api.currentSubscriber.id
    };

    return this._sendRequest(buildRoute(groupAvatarSettings), body);
  }

  async uploadSubscriberAvatar (avatar, mimeType) {
    if (!Buffer.isBuffer(avatar)) {
      throw new Error('avatar must be a buffer');
    }
    const subscriberAvatarSettings = this._api._botConfig.get('multimedia.avatar.subscriber');

    if (!subscriberAvatarSettings.validation.mimes.includes(mimeType)) {
      throw new Error('mimeType is unsupported');
    }

    const size = imageSize(avatar);

    if (size.width !== size.height) {
      throw new Error('avatar must be square');
    }

    const ext = (await fileType.fromBuffer(avatar)).ext;

    if (Buffer.byteLength(avatar) > subscriberAvatarSettings.validation.size[ext]) {
      throw new Error(`maximum size allowed for mimeType ${mimeType} is ${subscriberAvatarSettings.validation.size[ext]} bytes`);
    }

    const body = {
      data: avatar.toString('base64'),
      mimeType
    };

    return this._sendRequest(buildRoute(subscriberAvatarSettings), body);
  }

  async uploadEventThumbnail (eventId, thumbnail, mimeType) {
    if (!Buffer.isBuffer(thumbnail)) {
      throw new Error('thumbnail must be a buffer');
    }

    const eventThumbnailSettings = this._api._botConfig.get('multimedia.event');

    if (!eventThumbnailSettings.validation.mimes.includes(mimeType)) {
      throw new Error('mimeType is unsupported');
    }

    const size = imageSize(thumbnail);

    if (size.width !== size.height) {
      throw new Error('thumbnail must be square');
    }

    const body = {
      data: thumbnail.toString('base64'),
      mimeType,
      id: eventId,
      source: this._api.currentSubscriber.id
    };

    return this._sendRequest(buildRoute(eventThumbnailSettings), body);
  }
};
