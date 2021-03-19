#! /usr/bin/env node

const { Command } = require('commander')
const program = new Command()
const utils = require('./utils')
const { name, version, description } = require('../package.json')

program
  .name(name)
  .version(version, '-v, --version')
  .description(description)
  .option('-c, --config <config>', 'Path to [site].config.js file')
  .option('-d, --debug', 'Enable debug mode')
  .parse(process.argv)

async function main() {
  console.log('\r\nStarting...')

  const options = program.opts()
  const config = utils.loadConfig(options.config)
  if (options.debug) console.log(config)
  const client = utils.createHttpClient(config)
  const channels = utils.parseChannels(config.channels)
  const utcDate = utils.getUTCDate()
  const dates = Array.from({ length: config.days }, (_, i) => utcDate.add(i, 'd'))

  const queue = []
  channels.forEach(channel => {
    channel.logo = config.logo ? config.logo(channel) : null
    dates.forEach(date => {
      queue.push({ date, channel })
    })
  })

  let programs = []
  console.log('Parsing:')
  for (let item of queue) {
    const url = config.url(item)
    const progs = await client
      .get(url)
      .then(response => {
        const parserOptions = Object.assign({}, item, config, {
          content: response.data
        })
        const programs = config
          .parser(parserOptions)
          .filter(i => i)
          .map(p => {
            p.channel = item.channel.xmltv_id
            return p
          })

        console.log(
          `  ${config.site} - ${item.channel.xmltv_id} - ${item.date.format('MMM D, YYYY')} (${
            programs.length
          } programs)`
        )

        return programs
      })
      .then(utils.sleep(config.delay))
      .catch(err => {
        console.log(
          `  ${config.site} - ${item.channel.xmltv_id} - ${item.date.format(
            'MMM D, YYYY'
          )} (0 programs)`
        )
        console.log(`    Error: ${err.message}`)
      })

    programs = programs.concat(progs)
  }

  const xml = utils.convertToXMLTV({ config, channels, programs })
  utils.writeToFile(config.output, xml)

  console.log(`File '${config.output}' successfully saved`)
  console.log('Finish')
}

main()
