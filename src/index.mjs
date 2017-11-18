import { ApolloLink, Observable } from 'apollo-link'
import { print } from 'graphql/language/printer'
import { extractFiles } from 'extract-files'

export { ReactNativeFile } from 'extract-files'

export const createUploadLink = (
  {
    includeExtensions,
    uri: linkUri = '/graphql',
    credentials: linkCredentials,
    headers: linkHeaders,
    fetchOptions: linkFetchOptions = {},
    fetch: linkFetch = fetch
  } = {}
) =>
  new ApolloLink(
    ({ operationName, variables, query, extensions, getContext }) =>
      new Observable(observer => {
        const requestOperation = {
          operationName,
          variables,
          query: print(query)
        }

        if (includeExtensions) requestOperation.extensions = extensions

        const files = extractFiles(requestOperation)

        const {
          uri = linkUri,
          credentials = linkCredentials,
          headers: contextHeaders,
          fetchOptions: contextFetchOptions = {}
        } = getContext()

        const fetchOptions = {
          ...linkFetchOptions,
          ...contextFetchOptions,
          headers: {
            ...linkFetchOptions.headers,
            ...contextFetchOptions.headers,
            ...linkHeaders,
            ...contextHeaders
          },
          method: 'POST'
        }

        if (credentials) fetchOptions.credentials = credentials

        if (files.length) {
          // See https://github.com/jaydenseric/graphql-multipart-request-spec
          fetchOptions.body = new FormData()

          const filesMap = files.reduce((map, { path }, index) => {
            map[`${index}`] = [path]
            return map
          }, {})

          fetchOptions.body.append('files', JSON.stringify(filesMap))

          fetchOptions.body.append(
            'operations',
            JSON.stringify(requestOperation)
          )

          files.forEach(({ file }, index) =>
            fetchOptions.body.append(`${index}`, file)
          )
        } else {
          fetchOptions.headers['content-type'] = 'application/json'
          fetchOptions.body = JSON.stringify(requestOperation)
        }

        linkFetch(uri, fetchOptions)
          .then(response => {
            if (!response.ok)
              throw new Error(`${response.status} (${response.statusText})`)
            return response.json()
          })
          .then(result => {
            observer.next(result)
            observer.complete()
          })
          .catch(error => observer.error(error))
      })
  )
