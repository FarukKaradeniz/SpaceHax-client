import arg from "arg"

const getArgs = () => {
    return arg({"--token": String, "--baseUrl": String, "--room": String, "--pw": String});
}

export default getArgs;