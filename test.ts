function zip<T, U>(arr1: T[], arr2: U[]): [T, U][] {
  const result: [T, U][] = [];
  const length = Math.min(arr1.length, arr2.length);

  for (let i = 0; i < length; i++) {
    result.push([arr1[i], arr2[i]]);
  }

  return result;
}

// Example usage:
const array1 = [1, 2, 3];
const array2 = ["a", "b", "c"];

const zippedArray = zip(array1, array2);
console.log(zippedArray);
