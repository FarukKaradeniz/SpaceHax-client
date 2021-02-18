import arg from "arg"

const getArgs = () => {
    return arg({"--token": String, "--baseUrl": String, "--room": String});
}

export default getArgs;