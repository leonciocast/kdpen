
import React from 'react'
import styles from './page.module.css'
import SudokuGenerator from '@/components/sudoku/SudokuGenerator'

const Page = () => {

    return (
        <>

            <SudokuGenerator styles={styles} />
        </>
    )
}

export default Page