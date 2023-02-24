import validator from '../../validator/index.js';
import { Privilege } from '../../constants/index.js';

/**
 *
 * @param {import('wolf.js').WOLF} client
 * @param {import('wolf.js').CommandContext} command
 */
export default async (client, command) => {
  // Check to see if the user is authorized, staff or the bot developer
  if (client.config.framework?.developer !== command.sourceSubscriberId && !await client.utility.subscriber.privilege.has(command.sourceSubscriberId, Privilege.STAFF) && !await client.authorization.isAuthorized(command.sourceSubscriberId)) {
    return await command.reply(
      client.utility.string.replace(client.phrase.getByLanguageAndName(command.language, `${client.config.keyword}_permission_error_message`),
        {
          nickname: (await command.subscriber()).nickname,
          subscriberId: command.sourceSubscriberId
        }
      )
    );
  }

  if (!command.argument) {
    if (!command.isGroup) {
      return await command.reply(
        client.utility.string.replace(client.phrase.getByLanguageAndName(command.language, `${client.config.keyword}_leave_error_unsupported_message`),
          {
            nickname: (await command.subscriber()).nickname,
            subscriberId: command.sourceSubscriberId
          }
        )
      );
    }

    await command.reply(
      client.utility.string.replace(client.phrase.getByLanguageAndName(command.language, `${client.config.keyword}_leave_message`),
        {
          nickname: (await command.subscriber()).nickname,
          subscriberId: command.sourceSubscriberId
        }
      )
    );

    return await client.group.leaveById(command.targetGroupId);
  }

  const userInput = command.argument.split(client.SPLIT_REGEX).filter(Boolean)[0];

  if (validator.isLessThanOrEqualZero(userInput)) {
    return await command.reply(
      client.utility.string.replace(client.phrase.getByLanguageAndName(command.language, `${client.config.keyword}_leave_error_invalid_group_id_message`),
        {
          nickname: (await command.subscriber()).nickname,
          subscriberId: command.sourceSubscriberId,
          arg: userInput
        }
      )
    );
  }

  const result = await client.group.leaveById(parseInt(userInput));

  return await command.reply(
    client.utility.string.replace(client.phrase.getByLanguageAndName(command.language, `${client.config.keyword}_leave_${result.success ? 'success' : 'failed'}_message`),
      {
        nickname: (await command.subscriber()).nickname,
        subscriberId: command.sourceSubscriberId,
        reason: result.success ? '' : result.headers && result.headers.message ? result.headers.message : client.phrase.getByLanguageAndName(command.language, `${client.config.keyword}_error_unknown_reason_message`)
      }
    )
  );
};
