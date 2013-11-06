## uploading

http://www.flickr.com/services/api/upload.api.html

> For details of how to obtain authentication tokens and how to sign calls, see the authentication api spec. Note that the 'photo' parameter should not be included in the signature. All other POST parameters should be included when generating the signature.

## upload

`POST http://up.flickr.com/services/upload/`

| field | description |  |
|:------|:------------|:-|
| photo | The file to upload. | |
| title | The title of the photo. | optional |
| description | A description of the photo. May contain some limited HTML. | optional |
| tags | A space-seperated list of tags to apply to the photo. | optional |
| is_public | Set to 0 for no, 1 for yes. Specifies who can view the photo. | optional |
| is_friend | Set to 0 for no, 1 for yes. Specifies who can view the photo. | optional |
| is_family | Set to 0 for no, 1 for yes. Specifies who can view the photo. | optional |
| safety_level | Set to 1 for Safe, 2 for Moderate, or 3 for Restricted. | optional |
| content_type | Set to 1 for Photo, 2 for Screenshot, or 3 for Other. | optional |
| hidden | Set to 1 to keep the photo in global search results, 2 to hide from public searches. | optional |

## replace

`POST http://ycpi.api.flickr.com/services/replace/`

| field | description |  |
|:------|:------------|:-|
| photo | The file to upload. | |
| photo_id | The ID of the photo to replace. | |
| async | Photos may be replaced in async mode, for applications that don't want to wait around for an upload to complete, leaving a socket connection open the whole time. Processing photos asynchronously is recommended. Please consult the documentation for details. | optional |
