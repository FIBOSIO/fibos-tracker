const http = require("http");
global.graphql = function(body) {
	return http.post(`http://127.0.0.1:8080/1.0/app/`, {
		headers: {
			'Content-Type': 'application/graphql'
		},
		body: body
	});
}