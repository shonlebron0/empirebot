import Capability from '../constants/Capability.js';
import Base from './Base.js';
import GroupAudioConfig from './GroupAudioConfig.js';
import GroupAudioCounts from './GroupAudioCounts.js';
import GroupExtended from './GroupExtended.js';
import GroupMemberList from './GroupMemberList.js';
import GroupMessageConfig from './GroupMessageConfig.js';
import IconInfo from './IconInfo.js';
import IdHash from './IdHash.js';

class Group extends Base {
  constructor (client, data) {
    super(client);

    this.id = data?.id;
    this.hash = data?.hash;
    this.name = data?.name;
    this.description = data?.description;
    this.reputation = data?.reputation;
    this.owner = new IdHash(data?.owner);
    this.membersCount = data?.memberCount;
    this.official = data?.official;
    this.peekable = data?.peekable;
    this.premium = data?.premium;
    this.icon = data?.icon;
    this.iconHash = data?.iconHash;
    this.iconInfo = new IconInfo(client, data?.iconInfo, 'group', data?.id);
    this.extended = new GroupExtended(client, data?.extended);
    this.audioCounts = new GroupAudioCounts(client, data?.audioCounts);
    this.audioConfig = new GroupAudioConfig(client, data?.audioConfig);
    this.messageConfig = new GroupMessageConfig(client, data?.messageConfig);
    this.members = new GroupMemberList(client, data?.id);
    this.verificationTier = data?.verificationTier;

    this.inGroup = false;
    this.capabilities = Capability.NOT_MEMBER;

    this.exists = data?.memberCount > 0;
  }

  getAvatarUrl (size) {
    return this.iconInfo.get(size);
  }

  async getAvatar (size) {
    return this.client.utility.group.avatar(this.id, size);
  }

  async join (password = undefined) {
    return await this.client.group.joinById(this.id, password);
  }

  async leave () {
    return await this.client.group.leaveById(this.id);
  }

  async stats () {
    return await this.client.group.getStats(this.id);
  }

  async slots () {
    return await this.client.stage.slot.list(this.id);
  }

  async sendMessage (content, options = undefined) {
    return await this.client.messaging.sendGroupMessage(this.id, content, options);
  }

  async update ({ description, peekable, disableHyperlink, disableImage, disableImageFilter, disableVoice, longDescription, discoverable, language, category, advancedAdmin, questionable, locked, closed, entryLevel, avatar }) {
    return await this.client.group.update(this.id, { description: description || this.description, peekable: peekable || this.peekable, disableHyperlink: disableHyperlink || this.messageConfig.disableHyperlink, disableImage: disableImage || this.messageConfig.disableImage, disableImageFilter: disableImageFilter || this.messageConfig.disableImageFilter, disableVoice: disableVoice || this.messageConfig.disableVoice, longDescription: longDescription || this.extended.longDescription, discoverable: discoverable || this.extended.discoverable, language: language || this.extended.language, category: category || this.extended.category, advancedAdmin: advancedAdmin || this.extended.advancedAdmin, questionable: questionable || this.extended.questionable, locked: locked || this.extended.locked, closed: closed || this.extended.closed, entryLevel: entryLevel || this.extended.entryLevel, avatar });
  }
}

export default Group;
