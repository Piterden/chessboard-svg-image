require('dotenv').config()
const fs = require('fs')
const express = require('express')
const { StaticCanvas, loadSVGFromString, util: { groupSVGElements } } = require('fabric').fabric
const { Board } = require('chess/dist/board')

const { APP_PORT } = process.env

const {
  FILES,
  BG_COLOR,
  BOARD_SIZE,
  MARKS_SIZE,
  TEXT_COLOR,
  CROSS_COLOR,
  MARKS_COLOR,
  SQUARE_SIZE,
  B_CELL_COLOR,
  W_CELL_COLOR,
  BOARD_PADDING,
} = require('./config')

const {
  makeDot,
  makeArrow,
  makeCross,
  makePiece,
  makeScale,
  makeSquare,
} = require('./svg')

const app = express()
const stubSvg = fs.readFileSync('stubs/stub.svg', { encoding: 'utf-8' })

const renderSVG = (board, {
  marks = [],
  scale,
  arrows = [],
  bgColor,
  marksSize,
  textColor,
  crossColor,
  marksColor,
  bCellColor,
  wCellColor,
  squareSize,
  whiteBottom,
  boardPadding,
}) => {
  const svgElements = []

  for (let i = 0; i < board.squares.length; i += 1) {
    const { file, rank, piece } = board.squares[i]
    const fileNumber = FILES.indexOf(file) + 1
    const x = ((whiteBottom ? 9 - fileNumber : fileNumber) - 1) * squareSize + boardPadding
    const y = ((whiteBottom ? rank : 9 - rank) - 1) * squareSize + boardPadding
    const color = (fileNumber + rank) % 2 ? wCellColor : bCellColor
    const squareId = `${file}${rank}`

    svgElements.push(makeSquare({ x, y, squareSize, squareId, color }))

    if (piece) {
      svgElements.push(makePiece({ x, y, piece, scale }))
    }

    if (marks.includes(squareId)) {
      svgElements.push(
        piece
          ? makeCross({ x, y, crossColor, scale })
          : makeDot({ x, y, squareSize, marksSize, marksColor, scale }),
      )
    }
  }

  const horizontal = FILES.split('')
  const vertical = Array.from({ length: 8 }, (item, idx) => 8 - idx)

  for (let i = 0; i < 8; i += 1) {
    const file = horizontal[whiteBottom ? 8 - i - 1 : i]
    const rank = vertical[whiteBottom ? 8 - i - 1 : i]

    svgElements.push(makeScale({
      i,
      file,
      rank,
      boardPadding,
      squareSize,
      textColor,
    }))
  }

  if (arrows.length > 0) {
    for (let i = 0; i < arrows.length; i += 1) {
      const arrow = arrows[i].match(
        /(?<fromFile>[a-h])(?<fromRank>\d)(?<toFile>[a-h])(?<toRank>\d)(?<color>[0-9a-f]{3,8})?/,
      )

      if (arrow) {
        svgElements.push(makeArrow({ ...arrow.groups, squareSize, boardPadding }))
      }
    }
  }

  return stubSvg
    .split('{{fullWidth}}').join(squareSize * 8 + boardPadding * 2)
    .split('{{bg}}').join(bgColor)
    .split('{{board}}').join(svgElements.join(''))
}

app.get('/:fen.jpeg', (req, res) => {
  const {
    rotate = 0,
    arrows = [],
    marks: marksList = '',
    bg_color: bgColor = BG_COLOR,
    board_size: boardSize = BOARD_SIZE,
    marks_size: marksSize = MARKS_SIZE,
    text_color: textColor = TEXT_COLOR,
    cross_color: crossColor = CROSS_COLOR,
    marks_color: marksColor = MARKS_COLOR,
    b_cell_color: bCellColor = B_CELL_COLOR,
    w_cell_color: wCellColor = W_CELL_COLOR,
  } = req.query
  const { fen = 'rnbkqbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBKQBNR' } = req.params

  const boardPadding = boardSize / 26
  const squareSize = boardPadding * 3
  const scale = boardSize / 390
  const marks = marksList.split(',')
  const whiteBottom = !!Number(rotate)

  res.contentType('image/jpeg')

  const svg = renderSVG(Board.load(fen), {
    marks,
    scale,
    arrows,
    bgColor,
    marksSize,
    textColor,
    crossColor,
    marksColor,
    squareSize,
    bCellColor,
    wCellColor,
    whiteBottom,
    boardPadding,
  })

  const canvas = new StaticCanvas('c', {
    width: boardSize,
    height: boardSize,
  })

  loadSVGFromString(svg, (objects, info) => {
    const ctx = canvas.getContext('2d')
    console.log(info)
    const scaleX = info.width ? (boardSize / info.width) : 1
    const scaleY = info.height ? (boardSize / info.height) : 1

    ctx.scale(scaleX, scaleY)

    const obj = groupSVGElements(objects, info)

    canvas.add(obj)
    canvas.renderAll()
    canvas.createJPEGStream().pipe(res)
  })
})

app.listen(APP_PORT)
