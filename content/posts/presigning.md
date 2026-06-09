+++
title = 'MiniTube - Presigned URLs - Insanely Useful Pattern for Sharing Data'
date = 2026-04-05T22:03:54+01:00
draft = false
tags = ["architecture", "go", "backend", "seaweedfs", "s3", "signing", "multipart", "video streaming"]
+++

This post is part of my _MiniTube_ series. Check out other related posts if you find this content useful.

## Presigning

I've gone over signing as a useful strategy to overcome extra network calls when you want to prove you have permission to do something in regards of someone else. Presigning achieves the same goals, but with a few more cherries on top. 

## MiniTube

If you haven't read my other posts on this topic. I've implemented a miniature video streaming architecture based on the system design interview by [hello interview](https://www.youtube.com/watch?v=IUrQ5_g3XKs).

In order to upload large files, the recommended architecture is to perform a multipart upload, and generating some upload URLs with pre-authorised codes, that the client can use to call the storage service directly on behalf of the server.

Here's how the sequence works:
1. Client initiates multipart upload
2. Server takes file size and splits in chunks
3. Server requests storage server to generate a presigned URL for each of the chunks
4. Server returns to client array of URLs
5. Client uploads at its pace each of the chunks to the corresponding URLs. _The presignature embeds credentials to access the specific path._
6. Storage server responds to each upload with an ETag as proof of upload and chunk order
7. Client submits all ETags to server
8. Server requests completion of multipart upload with ETags
9. Storage server validates order and validity of ETags and completes process

## URLs

What makes this presignature special? Besides including the credentials for the specific client to upload a specific chunk, of a specific size to a specific path, it also embeds information such as expiration date and refresh capabilities (if configured by server).

## Example

I'll give you some code examples of how to perform such a flow with vanilla javascript and Go with a S3-like API.


### Client initiates

```js
  const form = document.getElementById('upload')
  form.onsubmit = async (e) => {
    e.preventDefault()

    const fileInput = document.getElementById('file')
    const titleInput = document.getElementById('title')

    const file = fileInput.files[0]

    const payload = {
      size: file.size,
      content_type: file.type,
      title: titleInput.value
    }

    try {
      const res = await fetch(`/api/videos/upload/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-Id": crypto.randomUUID(),
          "Authorization": `Bearer ${jwt}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      console.log(data)

      const parts = await uploadParts(file, data)
      const result = await completeUpload(parts)
      console.log(result)
      form.reset()
      fileName.textContent = "No file selected"
      showSuccessModal()
    } catch (err) {
      console.error(err)
    }
  }
```

### Server initiates

```go
// error handling removed for brevity
func initUpload(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(r.Body)
	defer r.Body.Close()

	var video t.VideoMetadata
	err := decoder.Decode(&video)

	out, err := s3.Client.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{
		Bucket:      aws.String(s3.Bucket),
		Key:         aws.String(video.ObjectID),
		ContentType: aws.String(video.ContentType),
	})

	uploadID := *out.UploadId
	numParts := int(math.Ceil(float64(video.Size) / float64(PART_SIZE)))

	parts := make([]t.PresignedPart, 0, numParts)
	for i := 1; i <= numParts; i++ {
		req, err := s3.Presigner.PresignUploadPart(ctx, &s3.UploadPartInput{
			Bucket:     aws.String(s3Wrapper.Bucket),
			Key:        aws.String(video.ObjectID),
			UploadId:   aws.String(uploadID),
			PartNumber: aws.Int32(int32(i)),
		},
			s3.WithPresignExpires(15*time.Minute),
		)

		parts = append(parts, t.PresignedPart{
			PartNumber: int32(i),
			URL:        req.URL,
		})
	}
	payload, err := json.Marshal(video)

	w.WriteHeader(201)
	w.Header().Add("Content-Type", "application/json")
	w.Write(payload)
}
```

### Client uploads parts

```js
async function uploadParts(file, initResponse) {
    const { object_id, upload_id, part_size, parts } = initResponse

    const uploadedParts = []

    for (const part of parts) {
      const partNumber = part.part_number
      const url = part.url

      const start = (partNumber - 1) * part_size
      const end = Math.min(start + part_size, file.size)
      const blob = file.slice(start, end)

      console.log(`Uploading part ${partNumber} (${start}-${end})`)

      const res = await fetch(url, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": "application/octet-stream"
        }
      })

      if (!res.ok) {
        throw new Error(`Failed to upload part ${partNumber}`)
      }

      console.log({ res })
      const etag = res.headers.get('ETag')

      uploadedParts.push({
        partNumber,
        etag
      })
    }

    return {
      object_id,
      upload_id,
      parts: uploadedParts
    }
  }
```

### Client requests completion

```js
  async function completeUpload(payload) {
    const res = await fetch(`/api/videos/upload/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": crypto.randomUUID(),
        "Authorization": `Bearer ${jwt}`
      },
      body: JSON.stringify({
        object_id: payload.object_id,
        parts: payload.parts.map(p => ({ part_number: p.partNumber, etag: p.etag }))
      })
    })

    if (!res.ok) {
      throw new Error("Complete upload failed")
    }

    return await res.json()
  }
```

### Server requests completion

```go
func completeUpload(w http.ResponseWriter, r *http.Request) {
	type Req struct {
		ObjectID string            `json:"object_id"`
		Parts    []t.PresignedPart `json:"parts"`
	}

	decoder := json.NewDecoder(r.Body)
	defer r.Body.Close()
	var req Req
	err := decoder.Decode(&req)

	var video t.VideoMetadata
	err := mongoWrapper.C.FindOne(ctx, bson.M{"object_id": req.ObjectID}).Decode(&video)

	listed, err := s3.Client.ListParts(ctx, &s3.ListPartsInput{
		Bucket:   aws.String(s3.Bucket),
		Key:      aws.String(video.ObjectID),
		UploadId: aws.String(video.UploadID),
	})

	var parts []types.Part
	for _, p := range req.Parts {
		parts = append(parts, types.Part{ETag: &p.ETag, PartNumber: &p.PartNumber})
	}

	if !validateParts(listed.Parts, parts) {
        // removed for brevity
    }

	var completedParts = types.CompletedMultipartUpload{}
	for _, p := range req.Parts {
		completedParts.Parts = append(completedParts.Parts, types.CompletedPart{ETag: &p.ETag, PartNumber: &p.PartNumber})
	}

	_, err = s3.Client.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
		Bucket:          aws.String(s3.Bucket),
		Key:             aws.String(video.ObjectID),
		UploadId:        aws.String(video.UploadID),
		MultipartUpload: &completedParts,
	})

	payload, err := json.Marshal(video)
	w.WriteHeader(200)
	w.Write(payload)
}

func validateParts(source, provided []types.Part) bool {
	if len(source) != len(provided) {
		return false
	}
	for i := range source {
		if aws.ToString(source[i].ETag) != aws.ToString(provided[i].ETag) {
			return false
		}
		if aws.ToInt32(source[i].PartNumber) != aws.ToInt32(provided[i].PartNumber) {
			return false
		}
	}
	return true
}
```

## Conclusion

This post doesn't cover refreshing, timeouts, or reconnection handling—those make good follow-up exercises. 

Feel free to play around with the project by cloning the [repo](https://github.com/jmpargana/minitube/tree/main).