// Loaded only in the isolated integration-test server. All GitHub writes stay in memory.
const original = global.fetch;
const created = [];
global.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.hostname !== "api.github.com") return original(input, init);
  if (url.pathname === "/repos/ailubes/uagp/issues" && request.method === "POST") {
    const {title,body} = await request.json();
    if (title === "Відмова") return Response.json({}, {status:403});
    const issue = {title,body,number:created.length+1};
    created.push(issue);
    if (title === "Втрачена відповідь") throw Error("Simulated dropped response");
    return Response.json(issue,{status:201});
  }
  const number = Number(url.pathname.split("/").pop());
  return Response.json(created[number-1] || {},{status:created[number-1] ? 200 : 404});
};
