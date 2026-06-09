import boto3
import logging
import json
from utils import respond, get_table
from botocore.exceptions import ClientError

SES = boto3.client('ses')
TABLE = get_table()

def lambda_handler(event, context):
    try:
        response = TABLE.scan()
    except ClientError as e:
        logging.error(f"Error scanning DynamoDB table: {e}")
        return respond(500, "Failed to scan subscriber table")

    items = response.get('Items', [])
    if not items:
        logging.info("No subscribers found in DynamoDB table")
        return respond(200, "No subscribers to send emails to")

    errors = []

    for i in items:
        email,token = i.get('Email'),i.get('Token')
        try:
            template_data = json.dumps({"unsubscribe_token": token})
            send_response = SES.send_templated_email(
                Source='newsletter@jmpargana.com',
                Destination={'ToAddresses': [email]},
                Template='jmpargana-newsletter',
                TemplateData=template_data
            )
            logging.info(f"Email sent to {email} with response: {send_response}")
        except ClientError as e:
            error_msg = f"Failed to send email to {email} with Token {token}: {e}"
            logging.error(error_msg)
            errors.append(error_msg)
        except Exception as e:
            error_msg = f"Unexpected error sending email to {email} with Token {token}: {e}"
            logging.exception(error_msg)
            errors.append(error_msg)

    if errors:
        return respond(500, {"message": "Errors occurred while sending emails", "errors": errors})

    return respond(200, "Broadcasted successfully")