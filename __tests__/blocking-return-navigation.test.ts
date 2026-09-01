import { router } from 'expo-router'
import { returnToBlocks } from '@/features/blocking/navigation/return-to-blocks'

jest.mock('expo-router', () => ({
  router: { dismissTo: jest.fn() },
}))

describe('returnToBlocks', () => {
  it('dismisses the creation flow to the existing Blocks tab', () => {
    returnToBlocks()

    expect(router.dismissTo).toHaveBeenCalledWith('/(tabs)/blocks')
  })
})
