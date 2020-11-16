import arg from "arg"

const getArgs = () => {
    return arg({"--token": String});
}

export default getArgs;