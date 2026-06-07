import boto3

from app.config import settings


def s3_client():
    if not settings.s3_enabled:
        return None
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
    )


def ensure_bucket() -> None:
    if not settings.s3_enabled:
        return
    client = s3_client()
    bucket = settings.s3_bucket
    try:
        client.head_bucket(Bucket=bucket)
    except Exception:
        client.create_bucket(Bucket=bucket)
