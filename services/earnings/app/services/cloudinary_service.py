def upload_raw_file(file_bytes: bytes, filename: str, folder: str = "fairgig/imports") -> dict:
    import cloudinary
    import cloudinary.uploader
    from app.config import get_settings

    s = get_settings()
    cloudinary.config(
        cloud_name=s.cloudinary_cloud_name,
        api_key=s.cloudinary_api_key,
        api_secret=s.cloudinary_api_secret,
    )
    result = cloudinary.uploader.upload(
        file_bytes,
        resource_type="raw",
        folder=folder,
        public_id=filename,
        use_filename=True,
        unique_filename=True,
    )
    return {"public_id": result["public_id"], "secure_url": result["secure_url"]}


def upload_screenshot(file_bytes: bytes, worker_id: str, shift_id: str) -> dict:
    import cloudinary
    import cloudinary.uploader
    from app.config import get_settings

    s = get_settings()
    cloudinary.config(
        cloud_name=s.cloudinary_cloud_name,
        api_key=s.cloudinary_api_key,
        api_secret=s.cloudinary_api_secret,
    )
    result = cloudinary.uploader.upload(
        file_bytes,
        resource_type="image",
        folder=f"fairgig/screenshots/{worker_id}",
        public_id=shift_id,
        use_filename=True,
        unique_filename=True,
    )
    return {
        "public_id": result["public_id"],
        "secure_url": result["secure_url"],
        "width": result.get("width"),
        "height": result.get("height"),
        "format": result.get("format"),
    }
