class ObjectUses {
    static switchContent(obj, propOne, propTwo) {
      [obj[propOne], obj[propTwo]] = [obj[propTwo], obj[propOne]]
    }
  
    static cloneArray(myArray) {
      return myArray.map(item => ObjectUses.deepClone(item))
    }
    
    static cloneObj(myObj) {
      return ObjectUses.mapper(myObj, value => ObjectUses.deepClone(value))
    }
    
    static deepClone(original) {
      if(Array.isArray(original)) {
        return ObjectUses.cloneArray(original)
      }
      if(typeof original === 'object') {
        return ObjectUses.cloneObj(original)
      }
      return original;
    }
    
    static mapper(obj, callback) {
      if(typeof obj !== 'object') {
        throw new Error(`'${obj}' is not an object.`)
      }
      
      const newObj = new Object()
  
      for(let [value, key] of Object.entries(obj).map(item => item.reverse())) {
        newObj[key] = callback(value, key, obj)
      }
      return newObj
    } 
  }
  
  module.exports = ObjectUses