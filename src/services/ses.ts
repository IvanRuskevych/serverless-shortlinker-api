import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient();
const { SES_EMAIL } = process.env;

export const sendEmailsForDeactivatedLinks = async (event: { Records: any }) => {
  const records = event.Records;

  if (records) {
    for (const item of records) {
      const message = JSON.parse(item.body);

      await ses.send(
        new SendEmailCommand({
          Source: SES_EMAIL,

          Destination: {
            ToAddresses: [message.ToAddresses],
          },

          Message: {
            Subject: { Data: "The shorted link has expired and deactivated" },

            Body: {
              Html: {
                Data: `The shorted link (ID: ${message.linkID}) has expired and deactivated.`,
              },
            },
          },
        })
      );
    }
  }

  return;
};
