/**
 * Contentful Delivery API SDK. Allows you to create instances of a client
 * with access to the Contentful Content Delivery API.
 * @namespace contentful
 * @see ContentfulClientAPI
 */

import assign from 'lodash/assign'
import axios from 'axios'
import {createHttpClient, getUserAgentHeader} from 'contentful-sdk-core'
import createContentfulApi from './create-contentful-api'
import createLinkResolver from './create-link-resolver'
import version from '../version.js'
import Promise from 'bluebird'
import superagent from 'superagent'
import superAgentPromise from 'superagent-promise'
import _ from 'lodash'

const agent = superAgentPromise(superagent, Promise)

/**
 * Create a client instance
 * @func
 * @name createClient
 * @memberof contentful
 * @param {Object} params - Client initialization parameters
 * @prop {string} params.space - Space ID
 * @prop {string} params.accessToken - Contentful CDA Access Token
 * @prop {boolean=} params.insecure - Requests will be made over http instead of the default https (default: true)
 * @prop {string=} params.host - API host (default: cdn.contentful.com). Also usable with preview.contentful.com.
 * @prop {Object=} params.httpAgent - Optional Node.js HTTP agent for proxying (see <a href="https://nodejs.org/api/http.html#http_class_http_agent">Node.js docs</a> and <a href="https://www.npmjs.com/package/https-proxy-agent">https-proxy-agent</a>)
 * @prop {Object=} params.httpsAgent - Optional Node.js HTTP agent for proxying (see <a href="https://nodejs.org/api/http.html#http_class_http_agent">Node.js docs</a> and <a href="https://www.npmjs.com/package/https-proxy-agent">https-proxy-agent</a>)
 * @prop {Object=} params.proxy - Optional Axios proxy (see <a href="https://github.com/mzabriskie/axios#request-config"> axios docs </a>)
 * @prop {Object=} params.headers - Optional additional headers
 * @prop {boolean=} params.resolveLinks - If we should resolve links between entries
 * @prop {string=?} params.application - Application name and version e.g myApp/version
 * @prop {string=?} params.integration - Integration name and version e.g react/version
 * @returns {ContentfulClientAPI.ClientAPI}
 * @example
 * const contentful = require('contentful')
 * const client = contentful.createClient({
 *  accessToken: 'myAccessToken',
 *  space: 'mySpaceId'
 * })
 */

export function createClient (params) {
  if (!params.accessToken) {
    throw new TypeError('Expected parameter accessToken')
  }

  if (!params.space) {
    throw new TypeError('Expected parameter space')
  }

  // Use resolveLinks param if specified, otherwise default to true
  const resolveLinks = !!('resolveLinks' in params ? params.resolveLinks : true)
  const shouldLinksResolve = createLinkResolver(resolveLinks)
  const userAgentHeader = getUserAgentHeader(`contentful.js/${version}`,
    params.application,
    params.integration
  )
  params.defaultHostname = 'cdn.contentful.com'
  params.headers = assign(params.headers, {
    'Content-Type': 'application/vnd.contentful.delivery.v1+json',
    'X-Contentful-User-Agent': userAgentHeader
  })

  const http = createNonAxiosHTTPClient(params)

  return createContentfulApi({
    http: http,
    shouldLinksResolve: shouldLinksResolve
  })
}

function createNonAxiosHTTPClient(params) {

  const baseURL = createURL(params)
  const defaultHeaders = createDefaultHeaders(params)

  return {
    get: function(path, options) {
      const headers = _.assign(_.clone(defaultHeaders), options.headers || {})
      return agent.get(`${baseURL}${path}`)
        .query(options.query)
        .set(headers)
    }
  }
}

function createURL(params) {
  const {space, accessToken, insecure, host, defaultHostname, retryOnError} = params
  let {defaultHeaders} = params
  let [hostname, port] = (host && host.split(':')) || []
  hostname = hostname || defaultHostname
  port = port || (insecure ? 80 : 443)
  let baseURL = `${insecure ? 'http' : 'https'}://${hostname}:${port}/spaces/`
  if (space) {
    baseURL += space + '/'
  }
  return baseURL
}

function createDefaultHeaders(params) {
  const {accessToken, retryOnError} = params
  let {defaultHeaders} = params
  defaultHeaders = defaultHeaders || {}
  defaultHeaders['Authorization'] = 'Bearer ' + accessToken

  // Set these headers only for node because browsers don't like it when you
  // override user-agent or accept-encoding.
  // The SDKs should set their own X-Contentful-User-Agent.
  if (process && process.release && process.release.name === 'node') {
    defaultHeaders['user-agent'] = 'node.js/' + process.version
    defaultHeaders['Accept-Encoding'] = 'gzip'
  }
  return defaultHeaders
}