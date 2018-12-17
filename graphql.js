const http = require("http");

const port = require('./port')

global.graphql = function(body) {
	return http.post(`http://127.0.0.1:${port}/1.0/app/`, {
		headers: {
			'Content-Type': 'application/graphql'
		},
		body: body
	});
}